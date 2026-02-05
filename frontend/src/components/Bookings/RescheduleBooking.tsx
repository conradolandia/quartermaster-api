import {
  Button,
  ButtonGroup,
  createListCollection,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  BookingsService,
  TripsService,
  TripBoatsService,
  type BookingPublic,
  type TripPublic,
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
import { formatTripLabel } from "@/utils"

interface RescheduleBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess?: (updated: BookingPublic) => void
}

export default function RescheduleBooking({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: RescheduleBookingProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [targetTripId, setTargetTripId] = useState<string>("")
  const [targetBoatId, setTargetBoatId] = useState<string | null>(null)

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

  const { trips, isLoading: tripsLoading } = useTripsByMission(
    effectiveMissionId,
    isOpen && !!effectiveMissionId,
  )

  const { data: tripBoats = [], isLoading: boatsLoading } = useQuery({
    queryKey: ["trip-boats", targetTripId],
    queryFn: () =>
      TripBoatsService.readTripBoatsByTrip({ tripId: targetTripId }),
    enabled: isOpen && !!targetTripId,
  })

  const needsBoat = tripBoats.length > 1
  const singleBoatId = tripBoats.length === 1 ? tripBoats[0].boat_id : null

  useEffect(() => {
    if (!isOpen) {
      setTargetTripId("")
      setTargetBoatId(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (needsBoat) setTargetBoatId(null)
    else setTargetBoatId(singleBoatId ?? null)
  }, [needsBoat, singleBoatId])

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      BookingsService.reschedule({
        bookingId: booking.id,
        requestBody: {
          target_trip_id: targetTripId,
          boat_id: needsBoat ? targetBoatId ?? undefined : undefined,
        },
      }),
    onSuccess: (updated) => {
      showSuccessToast("Booking rescheduled successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
      onClose()
      onSuccess?.(updated)
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

  const canSubmit =
    !!targetTripId && (!needsBoat || !!targetBoatId) && !rescheduleMutation.isPending

  const tripOptions = trips.map((t: TripPublic) => ({
    value: t.id,
    label: formatTripLabel(t),
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
            Move this booking&apos;s ticket items to another trip in the same
            mission. Merchandise items stay on their current trips.
          </Text>
          {!hasTicketItems && (
            <Text color="status.error" mb={4}>
              This booking has no ticket items to reschedule.
            </Text>
          )}
          {hasTicketItems && (
            <VStack align="stretch" gap={4}>
              {!effectiveMissionId && !firstTrip && (
                <Text color="text.muted">
                  Loading mission…
                </Text>
              )}
              {effectiveMissionId && (
                <>
                  <Field label="Target trip">
                    <Select.Root
                      collection={createListCollection({
                        items: tripOptions,
                      })}
                      value={targetTripId ? [targetTripId] : []}
                      onValueChange={(e: { value: string[] }) =>
                        setTargetTripId(e.value[0] ?? "")
                      }
                      disabled={tripsLoading}
                    >
                      <Select.Control width="100%">
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select a trip" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                          <Select.Indicator />
                        </Select.IndicatorGroup>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {tripOptions.map((opt) => (
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
