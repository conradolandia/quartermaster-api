import {
  Box,
  Button,
  ButtonGroup,
  Select,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  type BookingPublic,
  BookingsService,
  type LaunchPublic,
  LaunchesService,
  type MissionPublic,
  MissionsService,
  type RescheduleBookingResponse,
  TripBoatsService,
  type TripPublic,
  TripsService,
} from "@/client"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import useCustomToast from "@/hooks/useCustomToast"
import { useTripsByMission } from "@/hooks/useTripsByMission"
import { formatCents } from "@/utils"
import { formatTripOptionLabel, getItemTypeLabel } from "./types"

const wideSelectContentProps = {
  minWidth: { base: "var(--reference-width)", md: "420px" } as const,
  maxW: "min(90vw, 28rem)",
}

const selectItemLabel = (label: string) => (
  <Box whiteSpace="normal" textOverflow="unset">
    {label}
  </Box>
)

interface RescheduleBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: RescheduleBookingResponse) => void
}

export default function RescheduleBooking({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: RescheduleBookingProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast, showWarningToast } =
    useCustomToast()
  const [selectedLaunchId, setSelectedLaunchId] = useState<string>("")
  const [selectedMissionId, setSelectedMissionId] = useState<string>("")
  const [targetTripId, setTargetTripId] = useState<string>("")
  const [targetBoatId, setTargetBoatId] = useState<string | null>(null)
  const [typeMapping, setTypeMapping] = useState<Record<string, string>>({})
  const hasInitializedDefaultsRef = useRef(false)

  const currentTripId =
    booking.items?.find((i) => !i.trip_merchandise_id)?.trip_id ?? ""
  const currentBoatId =
    booking.items?.find((i) => !i.trip_merchandise_id)?.boat_id ?? ""

  const { data: firstTrip } = useQuery({
    queryKey: ["trip", booking.items?.[0]?.trip_id],
    queryFn: () =>
      TripsService.readTrip({
        tripId: booking.items?.[0]?.trip_id ?? "",
      }),
    enabled:
      isOpen &&
      !!booking.items?.length &&
      !booking.mission_id &&
      !!booking.items[0].trip_id,
  })

  const effectiveMissionId = booking.mission_id ?? firstTrip?.mission_id ?? null

  const { data: launchesData, isLoading: launchesLoading } = useQuery({
    queryKey: ["launches"],
    queryFn: () => LaunchesService.readLaunches({ limit: 500 }),
    enabled: isOpen,
  })
  const launches = launchesData?.data ?? []

  const { data: missionsData } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions({ limit: 500 }),
    enabled: isOpen,
  })
  const allMissions = missionsData?.data ?? []
  const missions = selectedLaunchId
    ? allMissions.filter((m) => m.launch_id === selectedLaunchId)
    : []

  const { trips, isLoading: tripsLoading } = useTripsByMission(
    selectedMissionId || null,
    isOpen && !!selectedMissionId,
  )

  const { data: tripBoats = [], isLoading: boatsLoading } = useQuery({
    queryKey: ["trip-boats", targetTripId],
    queryFn: () =>
      TripBoatsService.readTripBoatsByTrip({ tripId: targetTripId }),
    enabled: isOpen && !!targetTripId,
  })

  const needsBoat = tripBoats.length > 1
  const singleBoatId = tripBoats.length === 1 ? tripBoats[0].boat_id : null

  const effectiveBoatId = needsBoat ? targetBoatId : singleBoatId

  const originMerchItems = useMemo(() => {
    return (booking.items ?? []).filter((i) => i.trip_merchandise_id)
  }, [booking.items])

  const originTicketTypes = useMemo(() => {
    const byType: Record<string, number> = {}
    for (const i of booking.items ?? []) {
      if (i.trip_merchandise_id) continue
      byType[i.item_type] = (byType[i.item_type] ?? 0) + i.quantity
    }
    return Object.entries(byType).map(([type, quantity]) => ({
      type,
      quantity,
    }))
  }, [booking.items])

  const { data: effectivePricing = [], isLoading: pricingLoading } = useQuery({
    queryKey: ["trip-boats", "pricing", targetTripId, effectiveBoatId],
    queryFn: () =>
      TripBoatsService.readEffectivePricing({
        tripId: targetTripId,
        boatId: effectiveBoatId ?? "",
      }),
    enabled: isOpen && !!targetTripId && !!effectiveBoatId,
  })

  const ticketTypeOptions = effectivePricing
  const ticketTypeKeys = useMemo(
    () => ticketTypeOptions.map((p) => p.ticket_type).join(","),
    [ticketTypeOptions],
  )

  useEffect(() => {
    if (!isOpen) {
      hasInitializedDefaultsRef.current = false
      setSelectedLaunchId("")
      setSelectedMissionId("")
      setTargetTripId("")
      setTargetBoatId(null)
      setTypeMapping({})
    }
  }, [isOpen])

  // Seed launch + mission from the booking once missions are loaded (once per open).
  useEffect(() => {
    if (!isOpen || hasInitializedDefaultsRef.current || !missionsData) return
    const missionId = effectiveMissionId
    if (!missionId) return
    const launchId = allMissions.find((m) => m.id === missionId)?.launch_id
    if (!launchId) return

    setSelectedLaunchId(launchId)
    setSelectedMissionId(missionId)
    hasInitializedDefaultsRef.current = true
  }, [isOpen, missionsData, effectiveMissionId, allMissions, firstTrip])

  // Seed target trip once trips for the mission are loaded.
  useEffect(() => {
    if (!isOpen || !selectedMissionId || tripsLoading || !currentTripId) return
    setTargetTripId((prev) => {
      if (prev) return prev
      const inList = trips.some(
        (t: TripPublic) => !t.archived && t.id === currentTripId,
      )
      return inList ? currentTripId : prev
    })
  }, [isOpen, selectedMissionId, trips, tripsLoading, currentTripId])

  // Seed boat from booking when trip boats are loaded (or auto-pick sole boat).
  useEffect(() => {
    if (!isOpen || !targetTripId || boatsLoading) return
    if (!needsBoat) {
      setTargetBoatId(singleBoatId ?? null)
      return
    }
    setTargetBoatId((prev) => {
      if (prev && tripBoats.some((tb) => tb.boat_id === prev)) return prev
      if (
        currentBoatId &&
        tripBoats.some((tb) => tb.boat_id === currentBoatId)
      ) {
        return currentBoatId
      }
      return prev
    })
  }, [
    isOpen,
    targetTripId,
    boatsLoading,
    needsBoat,
    singleBoatId,
    currentBoatId,
    tripBoats,
  ])

  useEffect(() => {
    if (ticketTypeOptions.length === 0 || originTicketTypes.length === 0) {
      setTypeMapping((prev) => (Object.keys(prev).length ? {} : prev))
      return
    }
    const destTypes = new Set(ticketTypeOptions.map((p) => p.ticket_type))
    setTypeMapping((prev) => {
      const next = { ...prev }
      let changed = false
      for (const { type } of originTicketTypes) {
        const current = next[type]
        const inList = current && destTypes.has(current)
        if (!inList) {
          const fallback = destTypes.has(type)
            ? type
            : ticketTypeOptions[0]?.ticket_type ?? ""
          if (fallback) {
            next[type] = fallback
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [
    targetTripId,
    effectiveBoatId,
    ticketTypeKeys,
    originTicketTypes,
    ticketTypeOptions,
  ])

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      BookingsService.reschedule({
        bookingId: booking.id,
        requestBody: {
          target_trip_id: targetTripId,
          boat_id: needsBoat ? targetBoatId ?? undefined : undefined,
          type_mapping:
            ticketTypeOptions.length > 0 && typeMappingComplete
              ? Object.fromEntries(
                  originTicketTypes.map(({ type }) => [
                    type,
                    typeMapping[type]!.trim(),
                  ]),
                )
              : undefined,
        },
      }),
    onSuccess: (result) => {
      showSuccessToast("Booking rescheduled successfully")
      if (result.merchandise_auto_attached?.length) {
        const names = result.merchandise_auto_attached
          .map((m) => m.name)
          .join(", ")
        showWarningToast(
          "Merchandise added to target trip",
          `${names} ${
            result.merchandise_auto_attached.length === 1 ? "was" : "were"
          } not on the target trip and ${
            result.merchandise_auto_attached.length === 1 ? "was" : "were"
          } linked automatically (overrides copied from the source trip).`,
        )
        queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
      }
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
      onClose()
      onSuccess?.(result)
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } })?.body?.detail
      showErrorToast(
        typeof detail === "string" ? detail : "Failed to reschedule booking",
      )
    },
  })

  const handleSubmit = () => {
    if (!targetTripId) return
    if (needsBoat && !targetBoatId) {
      showErrorToast("Please select a boat")
      return
    }
    rescheduleMutation.mutate()
  }

  const ticketTypeRequired = ticketTypeOptions.length > 0
  const typeMappingComplete =
    originTicketTypes.length === 0 ||
    originTicketTypes.every(({ type }) => !!typeMapping[type]?.trim())
  const canSubmit =
    !!targetTripId &&
    (!needsBoat || !!targetBoatId) &&
    (!ticketTypeRequired || typeMappingComplete) &&
    !rescheduleMutation.isPending

  const tripOptions = trips
    .filter((t: TripPublic) => !t.archived)
    .map((t: TripPublic) => ({
      value: t.id,
      label: formatTripOptionLabel(t),
    }))

  const boatOptions = tripBoats.map((tb) => ({
    value: tb.boat_id,
    label: tb.boat?.name ?? tb.boat_id,
  }))

  const hasTicketItems =
    booking.items?.some((i) => !i.trip_merchandise_id) ?? false

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
      size={{ base: "sm", md: "lg" }}
      placement="center"
      scrollBehavior="inside"
    >
      <DialogContent overflow="visible">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody overflow="visible" pb={8}>
          <Text mb={4} fontSize="sm" color="text.muted">
            Move this booking&apos;s tickets and merchandise to another trip in
            any mission (Launch Viewing or Pre-Launch). If the target trip does
            not yet offer a purchased product, it will be linked automatically
            using overrides from the source trip.
          </Text>
          {originMerchItems.length > 0 && (
            <Text mb={4} fontSize="sm" color="text.muted">
              Merchandise to move:{" "}
              {originMerchItems
                .map((i) => `${i.item_type} (×${i.quantity})`)
                .join(", ")}
            </Text>
          )}
          {!hasTicketItems && (
            <Text color="status.error" mb={4}>
              This booking has no ticket items to reschedule.
            </Text>
          )}
          {hasTicketItems && (
            <VStack align="stretch" gap={4}>
              {launchesLoading && launches.length === 0 && (
                <Text color="text.muted">Loading launches…</Text>
              )}
              {launches.length > 0 && (
                <>
                  <Field label="Launch">
                    <Select.Root
                      collection={createListCollection({
                        items: launches.map((l: LaunchPublic) => ({
                          value: l.id,
                          label: l.name ?? l.id,
                        })),
                      })}
                      value={selectedLaunchId ? [selectedLaunchId] : []}
                      onValueChange={(e: { value: string[] }) => {
                        const next = e.value[0] ?? ""
                        setSelectedLaunchId(next)
                        setSelectedMissionId("")
                        setTargetTripId("")
                        setTargetBoatId(null)
                        setTypeMapping({})
                      }}
                    >
                      <Select.Control width="100%">
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a launch" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {launches.map((l: LaunchPublic) => (
                            <Select.Item
                              key={l.id}
                              item={{ value: l.id, label: l.name ?? l.id }}
                            >
                              {l.name ?? l.id}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  </Field>
                  <Field label="Mission">
                    <Select.Root
                      collection={createListCollection({
                        items: missions.map((m: MissionPublic) => ({
                          value: m.id,
                          label: m.name ?? m.id,
                        })),
                      })}
                      value={selectedMissionId ? [selectedMissionId] : []}
                      onValueChange={(e: { value: string[] }) => {
                        const next = e.value[0] ?? ""
                        setSelectedMissionId(next)
                        setTargetTripId("")
                        setTargetBoatId(null)
                        setTypeMapping({})
                      }}
                      disabled={!selectedLaunchId}
                    >
                      <Select.Control width="100%">
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a mission" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {missions.map((m: MissionPublic) => (
                            <Select.Item
                              key={m.id}
                              item={{ value: m.id, label: m.name ?? m.id }}
                            >
                              {m.name ?? m.id}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  </Field>
                  <Field label="Target trip">
                    <Select.Root
                      collection={createListCollection({
                        items: tripOptions,
                      })}
                      positioning={{ sameWidth: false }}
                      value={targetTripId ? [targetTripId] : []}
                      onValueChange={(e: { value: string[] }) => {
                        const next = e.value[0] ?? ""
                        setTargetTripId(next)
                        setTargetBoatId(null)
                        setTypeMapping({})
                      }}
                      disabled={
                        !selectedLaunchId || !selectedMissionId || tripsLoading
                      }
                    >
                      <Select.Control width="100%">
                        <Select.Trigger width="100%" minW={0}>
                          <Select.ValueText
                            placeholder="Select a trip"
                            truncate={false}
                          />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content {...wideSelectContentProps}>
                          {tripOptions.map((opt) => (
                            <Select.Item
                              key={opt.value}
                              item={{ value: opt.value, label: opt.label }}
                            >
                              {selectItemLabel(opt.label)}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  </Field>
                  {needsBoat && (
                    <Field label="Boat">
                      <Select.Root
                        collection={createListCollection({
                          items: boatOptions,
                        })}
                        value={targetBoatId ? [targetBoatId] : []}
                        onValueChange={(e: { value: string[] }) =>
                          setTargetBoatId(e.value[0] ?? null)
                        }
                        disabled={boatsLoading}
                      >
                        <Select.Control width="100%">
                          <Select.Trigger>
                            <Select.ValueText placeholder="Select a boat" />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Select.Positioner>
                          <Select.Content>
                            {boatOptions.map((opt) => (
                              <Select.Item
                                key={opt.value}
                                item={{ value: opt.value, label: opt.label }}
                              >
                                {opt.label}
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    </Field>
                  )}
                  {ticketTypeOptions.length > 0 &&
                    originTicketTypes.length > 0 && (
                      <Field label="Map ticket types to destination" width="100%">
                        <VStack align="stretch" gap={3} width="100%">
                          {originTicketTypes.map(({ type, quantity }) => {
                            const ticketTypeItems = ticketTypeOptions.map(
                              (p) => ({
                                value: p.ticket_type,
                                label: `${getItemTypeLabel(
                                  p.ticket_type,
                                )} (${formatCents(p.price)})`,
                              }),
                            )
                            const ticketTypeCollection = createListCollection({
                              items: ticketTypeItems,
                            })
                            const selectedValue = typeMapping[type]
                            const selectedLabel =
                              ticketTypeItems.find(
                                (item) => item.value === selectedValue,
                              )?.label ?? "Select type on destination"

                            return (
                              <Box key={type} width="100%">
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  mb={2}
                                  color="fg.muted"
                                >
                                  {getItemTypeLabel(type)} ({quantity})
                                </Text>
                                <Select.Root
                                  collection={ticketTypeCollection}
                                  width="100%"
                                  positioning={{ sameWidth: true }}
                                  value={
                                    selectedValue ? [selectedValue] : []
                                  }
                                  onValueChange={(e: { value: string[] }) =>
                                    setTypeMapping((prev) => ({
                                      ...prev,
                                      [type]: e.value[0] ?? "",
                                    }))
                                  }
                                  disabled={pricingLoading}
                                >
                                  <Select.Control width="100%">
                                    <Select.Trigger
                                      justifyContent="space-between"
                                      width="100%"
                                    >
                                      <Text
                                        fontSize="sm"
                                        flex="1"
                                        minW={0}
                                        textAlign="left"
                                        whiteSpace="normal"
                                        overflow="visible"
                                        textOverflow="unset"
                                      >
                                        {selectedLabel}
                                      </Text>
                                    </Select.Trigger>
                                    <Select.IndicatorGroup>
                                      <Select.Indicator />
                                    </Select.IndicatorGroup>
                                  </Select.Control>
                                  <Select.Positioner>
                                    <Select.Content {...wideSelectContentProps}>
                                      {ticketTypeItems.map((item) => (
                                        <Select.Item
                                          key={item.value}
                                          item={item}
                                        >
                                          {selectItemLabel(item.label)}
                                          <Select.ItemIndicator />
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select.Positioner>
                                </Select.Root>
                              </Box>
                            )
                          })}
                        </VStack>
                      </Field>
                    )}
                  {targetTripId &&
                    effectiveBoatId &&
                    !pricingLoading &&
                    ticketTypeOptions.length === 0 && (
                      <Text color="text.muted" fontSize="sm">
                        No ticket types on the selected boat.
                      </Text>
                    )}
                </>
              )}
            </VStack>
          )}
        </DialogBody>
        <DialogFooter>
          <ButtonGroup>
            <Button variant="subtle" colorPalette="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorPalette="green"
              onClick={handleSubmit}
              loading={rescheduleMutation.isPending}
              disabled={!canSubmit || !hasTicketItems}
            >
              Reschedule
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
