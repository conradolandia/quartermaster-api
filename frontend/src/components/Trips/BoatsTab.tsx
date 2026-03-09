import { NativeSelect } from "@/components/ui/native-select"
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import {
  FiDollarSign,
  FiPlus,
  FiSliders,
  FiTrash2,
  FiUsers,
} from "react-icons/fi"

import {
  type ApiError,
  BoatsService,
  TripBoatsService,
  TripsService,
} from "@/client"
import PricingOverridesPanel from "@/components/Trips/PricingOverridesPanel"
import ReassignPassengersDialog from "@/components/Trips/ReassignPassengersDialog"
import { Field } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents, handleError } from "@/utils"

interface BoatsTabProps {
  tripId: string
  isOpen: boolean
  onPendingChange: (hasPending: boolean) => void
}

const BoatsTab = ({ tripId, isOpen, onPendingChange }: BoatsTabProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const [boatsData, setBoatsData] = useState<any[]>([])
  const [tripBoats, setTripBoats] = useState<any[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isAddingBoat, setIsAddingBoat] = useState(false)
  const [reassignFrom, setReassignFrom] = useState<{
    boat_id: string
    boatName: string
    used: number
  } | null>(null)
  const [reassignToBoatId, setReassignToBoatId] = useState("")
  const [reassignTypeMapping, setReassignTypeMapping] = useState<
    Record<string, string>
  >({})
  const [isReassignSubmitting, setIsReassignSubmitting] = useState(false)
  const [selectedTripBoatForPricing, setSelectedTripBoatForPricing] = useState<{
    id: string
    boatId: string
    boatName: string
  } | null>(null)
  const [editingCapacityTripBoatId, setEditingCapacityTripBoatId] = useState<
    string | null
  >(null)
  const [capacityInputValue, setCapacityInputValue] = useState("")
  const [hasPendingPricingChanges, setHasPendingPricingChanges] = useState(false)

  const hasPendingBoatsChanges =
    editingCapacityTripBoatId !== null || hasPendingPricingChanges

  useEffect(() => {
    onPendingChange(hasPendingBoatsChanges)
  }, [hasPendingBoatsChanges, onPendingChange])

  const boatsMap = useMemo(() => {
    const map = new Map<string, any>()
    boatsData.forEach((boat) => map.set(boat.id, boat))
    return map
  }, [boatsData])

  // Queries
  const { data: allBoats } = useQuery({
    queryKey: ["boats-for-edit-trip"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  const { data: tripBoatsData, refetch: refetchTripBoats } = useQuery({
    queryKey: ["trip-boats-for-edit", tripId],
    queryFn: async () => {
      const response = await TripBoatsService.readTripBoatsByTrip({ tripId })
      return response
    },
    enabled: isOpen,
  })

  // Mutations
  const updateTripBoatMutation = useMutation({
    mutationFn: (body: {
      tripBoatId: string
      max_capacity?: number | null
      use_only_trip_pricing?: boolean
      sales_enabled?: boolean
    }) =>
      TripBoatsService.updateTripBoat({
        tripBoatId: body.tripBoatId,
        requestBody: {
          ...(body.max_capacity !== undefined && {
            max_capacity: body.max_capacity,
          }),
          ...(body.use_only_trip_pricing !== undefined && {
            use_only_trip_pricing: body.use_only_trip_pricing,
          }),
          ...(body.sales_enabled !== undefined && {
            sales_enabled: body.sales_enabled,
          }),
        },
      }),
    onSuccess: async (_, variables) => {
      if (variables.max_capacity !== undefined) {
        showSuccessToast("Capacity updated.")
        setEditingCapacityTripBoatId(null)
        setCapacityInputValue("")
      } else if (variables.use_only_trip_pricing !== undefined) {
        showSuccessToast("Pricing mode updated.")
      } else if (variables.sales_enabled !== undefined) {
        showSuccessToast(
          variables.sales_enabled ? "Sales enabled." : "Sales disabled.",
        )
      }
      await refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats-for-edit", tripId] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  // Handlers
  const handleSaveCapacity = (tripBoatId: string) => {
    const trimmed = capacityInputValue.trim()
    if (trimmed === "") {
      updateTripBoatMutation.mutate({ tripBoatId, max_capacity: null })
      return
    }
    const num = Number.parseInt(trimmed, 10)
    if (Number.isNaN(num) || num < 1) return
    updateTripBoatMutation.mutate({ tripBoatId, max_capacity: num })
  }

  const handleAddBoat = async () => {
    if (!selectedBoatId) return
    try {
      const exists = tripBoats.some((tb) => tb.boat_id === selectedBoatId)
      if (exists) {
        showSuccessToast("This boat is already associated with this trip")
        return
      }
      await TripBoatsService.createTripBoat({
        requestBody: {
          trip_id: tripId,
          boat_id: selectedBoatId,
          max_capacity: maxCapacity || null,
          use_only_trip_pricing: false,
        },
      })
      showSuccessToast("The boat has been successfully added to this trip")
      setSelectedBoatId("")
      setMaxCapacity(undefined)
      setIsAddingBoat(false)
      await refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats-for-edit", tripId] })
    } catch (error) {
      console.error("Error adding boat to trip:", error)
      handleError(error as ApiError)
    }
  }

  const handleRemoveBoat = async (tripBoatId: string) => {
    try {
      await TripBoatsService.deleteTripBoat({ tripBoatId })
      showSuccessToast("The boat has been removed from this trip")
      await refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats-for-edit", tripId] })
    } catch (error) {
      console.error("Error removing boat from trip:", error)
      handleError(error as ApiError)
    }
  }

  const handleReassignConfirm = async () => {
    if (!reassignFrom || !reassignToBoatId) return
    setIsReassignSubmitting(true)
    try {
      const res = await TripsService.reassignTripBoat({
        tripId,
        requestBody: {
          from_boat_id: reassignFrom.boat_id,
          to_boat_id: reassignToBoatId,
          type_mapping: reassignTypeMapping,
        },
      })
      showSuccessToast(`Moved ${res.moved} passenger(s) to the selected boat.`)
      await refetchTripBoats()
      setReassignFrom(null)
      setReassignToBoatId("")
      setReassignTypeMapping({})
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats-for-edit", tripId] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    } catch (error) {
      console.error("Error reassigning passengers:", error)
      handleError(error as ApiError)
    } finally {
      setIsReassignSubmitting(false)
    }
  }

  // Effects
  useEffect(() => {
    if (allBoats?.data) setBoatsData(allBoats.data)
  }, [allBoats])

  useEffect(() => {
    if (tripBoatsData) {
      setTripBoats(Array.isArray(tripBoatsData) ? (tripBoatsData as any[]) : [])
    }
  }, [tripBoatsData])

  useEffect(() => {
    if (!reassignFrom || !reassignToBoatId) return
    const fromBoat = tripBoats.find((tb) => tb.boat_id === reassignFrom.boat_id)
    const toBoat = tripBoats.find((tb) => tb.boat_id === reassignToBoatId)
    const used: Record<string, number> =
      fromBoat && "used_per_ticket_type" in fromBoat
        ? (fromBoat as { used_per_ticket_type?: Record<string, number> })
            .used_per_ticket_type ?? {}
        : {}
    const targetTypes: string[] =
      toBoat &&
      "pricing" in toBoat &&
      Array.isArray((toBoat as { pricing?: { ticket_type: string }[] }).pricing)
        ? (
            (toBoat as { pricing: { ticket_type: string }[] }).pricing ?? []
          ).map((p) => p.ticket_type)
        : []
    const sourceTypesWithQty = Object.entries(used).filter(([, qty]) => qty > 0)
    if (sourceTypesWithQty.length === 0 || targetTypes.length === 0) {
      setReassignTypeMapping({})
      return
    }
    const next: Record<string, string> = {}
    for (const [srcType] of sourceTypesWithQty) {
      next[srcType] = targetTypes.includes(srcType)
        ? srcType
        : targetTypes[0] ?? ""
    }
    setReassignTypeMapping(next)
  }, [reassignFrom, reassignToBoatId, tripBoats])

  const reassignCanSubmit = useMemo(() => {
    if (!reassignFrom || !reassignToBoatId) return false
    const fromBoat = tripBoats.find((tb) => tb.boat_id === reassignFrom.boat_id)
    const used: Record<string, number> =
      fromBoat && "used_per_ticket_type" in fromBoat
        ? (fromBoat as { used_per_ticket_type?: Record<string, number> })
            .used_per_ticket_type ?? {}
        : {}
    const sourceTypesWithQty = Object.entries(used).filter(([, qty]) => qty > 0)
    if (sourceTypesWithQty.length === 0) return true
    return sourceTypesWithQty.every(
      ([t]) => reassignTypeMapping[t]?.trim() !== "",
    )
  }, [reassignFrom, reassignToBoatId, reassignTypeMapping, tripBoats])

  return (
    <>
      <Box width="100%">
        <Text fontWeight="bold" mb={2}>
          Associated Boats
        </Text>

        {tripBoats && tripBoats.length > 0 ? (
          <VStack align="stretch" mb={4} gap={2}>
            {tripBoats.map((tripBoat) => {
              const boat = boatsMap.get(tripBoat.boat_id)
              const maxCap = tripBoat.max_capacity ?? boat?.capacity ?? 0
              const isPricingOpen =
                selectedTripBoatForPricing?.id === tripBoat.id
              const pricing =
                "pricing" in tripBoat &&
                Array.isArray(
                  (tripBoat as { pricing?: unknown[] }).pricing,
                )
                  ? (
                      tripBoat as {
                        pricing: Array<{
                          ticket_type: string
                          price: number
                          capacity: number
                          remaining: number
                        }>
                      }
                    ).pricing
                  : []
              const u = tripBoat.used_per_ticket_type
              const used: number =
                u != null && typeof u === "object"
                  ? (Object.values(u) as number[]).reduce(
                      (a, b) => a + b,
                      0,
                    )
                  : 0
              const remaining = Math.max(0, maxCap - used)
              const hasBookings = used > 0
              return (
                <Box key={tripBoat.id}>
                  <Flex
                    justify="space-between"
                    align="center"
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                  >
                    <Box>
                      <Text color="gray.100" fontWeight="medium">
                        {boat?.name || "Unknown"}
                      </Text>
                      <Text
                        fontSize="xs"
                        color="gray.300"
                        mt={0.5}
                        lineHeight="1.2"
                      >
                        {used} of {maxCap} seats taken ({remaining}{" "}
                        remaining)
                        {(tripBoat.sales_enabled === false) && (
                          <Text as="span" color="orange.400" ml={1}>
                            — sales paused
                          </Text>
                        )}
                      </Text>
                      {pricing.length > 0 && (
                        <VStack align="start" gap={0}>
                          {pricing.map((p) => (
                            <Text
                              key={p.ticket_type}
                              fontSize="xs"
                              color="gray.500"
                              lineHeight="1.2"
                            >
                              {p.ticket_type}: $
                              {formatCents(p.price)} (
                              {Math.max(0, p.capacity - p.remaining)}
                              /{p.capacity} taken)
                            </Text>
                          ))}
                        </VStack>
                      )}
                    </Box>
                    <Flex gap={1} align="center">
                      {hasBookings && (
                        <IconButton
                          aria-label="Reassign passengers"
                          title="Reassign"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setReassignFrom({
                              boat_id: tripBoat.boat_id,
                              boatName: boat?.name || "Unknown",
                              used,
                            })
                          }
                        >
                          <FiUsers />
                        </IconButton>
                      )}
                      <IconButton
                        aria-label="Pricing overrides"
                        title="Pricing"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSelectedTripBoatForPricing(
                            isPricingOpen
                              ? null
                              : {
                                  id: tripBoat.id,
                                  boatId: tripBoat.boat_id,
                                  boatName: boat?.name || "Unknown",
                                },
                          )
                        }
                      >
                        <FiDollarSign />
                      </IconButton>
                      <IconButton
                        aria-label="Boat settings"
                        title="Settings"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const isSettingsOpen =
                            editingCapacityTripBoatId === tripBoat.id
                          if (isSettingsOpen) {
                            setEditingCapacityTripBoatId(null)
                            setCapacityInputValue("")
                          } else {
                            setEditingCapacityTripBoatId(tripBoat.id)
                            setCapacityInputValue(
                              tripBoat.max_capacity != null
                                ? String(tripBoat.max_capacity)
                                : boat?.capacity != null
                                  ? String(boat.capacity)
                                  : "",
                            )
                          }
                        }}
                      >
                        <FiSliders />
                      </IconButton>
                      <IconButton
                        aria-label="Remove boat"
                        children={<FiTrash2 />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        disabled={hasBookings}
                        title={
                          hasBookings
                            ? "Cannot remove: boat has booked passengers."
                            : undefined
                        }
                        onClick={() => {
                          if (tripBoat.id === selectedTripBoatForPricing?.id) {
                            setSelectedTripBoatForPricing(null)
                          }
                          if (tripBoat.id === editingCapacityTripBoatId) {
                            setEditingCapacityTripBoatId(null)
                          }
                          handleRemoveBoat(tripBoat.id)
                        }}
                      />
                    </Flex>
                  </Flex>
                  {editingCapacityTripBoatId === tripBoat.id && (
                    <Box
                      mt={2}
                      ml={2}
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                      borderColor="gray.400"
                      _dark={{ borderColor: "gray.600" }}
                    >
                      <Text fontWeight="bold" mb={2} fontSize="sm">
                        Settings for {boat?.name || "Unknown"}
                      </Text>
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        mb={3}
                      >
                        <Box>
                          <Text fontSize="sm">Sales enabled</Text>
                          <Text fontSize="xs" color="gray.500">
                            When off, new bookings on this boat are blocked.
                            Existing reservations are kept.
                          </Text>
                        </Box>
                        <Box
                          onClick={() =>
                            updateTripBoatMutation.mutate({
                              tripBoatId: tripBoat.id,
                              sales_enabled: !(tripBoat.sales_enabled ?? true),
                            })
                          }
                          cursor={
                            updateTripBoatMutation.isPending
                              ? "not-allowed"
                              : "pointer"
                          }
                          opacity={
                            updateTripBoatMutation.isPending ? 0.5 : 1
                          }
                        >
                          <Switch
                            checked={tripBoat.sales_enabled ?? true}
                            disabled={updateTripBoatMutation.isPending}
                          />
                        </Box>
                      </Flex>
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Capacity override
                      </Text>
                      <Text fontSize="xs" color="gray.500" mb={2}>
                        Boat default: {boat?.capacity ?? "—"} seats. Set a
                        custom limit for this trip or leave as the boat
                        default.
                      </Text>
                      <HStack gap={2} align="center" flexWrap="wrap">
                        <Input
                          type="number"
                          min={used}
                          size="sm"
                          width="24"
                          placeholder={String(boat?.capacity ?? "")}
                          value={capacityInputValue}
                          onChange={(e) =>
                            setCapacityInputValue(e.target.value)
                          }
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            updateTripBoatMutation.mutate({
                              tripBoatId: tripBoat.id,
                              max_capacity: null,
                            })
                          }}
                          loading={updateTripBoatMutation.isPending}
                        >
                          Use default
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => handleSaveCapacity(tripBoat.id)}
                          loading={updateTripBoatMutation.isPending}
                          disabled={
                            capacityInputValue.trim() === "" ||
                            (() => {
                              const n = Number.parseInt(
                                capacityInputValue.trim(),
                                10,
                              )
                              return Number.isNaN(n) || n < 1 || n < used
                            })()
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setEditingCapacityTripBoatId(null)
                            setCapacityInputValue("")
                          }}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    </Box>
                  )}
                  {isPricingOpen && (
                    <PricingOverridesPanel
                      tripBoatId={tripBoat.id}
                      boatId={tripBoat.boat_id}
                      boatName={boat?.name || "Unknown"}
                      tripId={tripId}
                      isOpen={isOpen}
                      tripBoats={tripBoats}
                      boatsMap={boatsMap}
                      onClose={() => setSelectedTripBoatForPricing(null)}
                      onPendingChange={setHasPendingPricingChanges}
                      onToggleUseOnlyTripPricing={(checked) =>
                        updateTripBoatMutation.mutate({
                          tripBoatId: tripBoat.id,
                          use_only_trip_pricing: checked,
                        })
                      }
                      isUpdatingTripBoat={updateTripBoatMutation.isPending}
                      useOnlyTripPricing={
                        tripBoat.use_only_trip_pricing ?? false
                      }
                    />
                  )}
                </Box>
              )
            })}
          </VStack>
        ) : (
          <Text mb={4}>No boats assigned to this trip yet.</Text>
        )}

        {isAddingBoat ? (
          <VStack
            align="stretch"
            gap={3}
            mb={4}
            p={3}
            borderWidth="1px"
            borderRadius="md"
          >
            <Field label="Select Boat" required>
              <NativeSelect
                value={selectedBoatId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedBoatId(e.target.value)
                }
              >
                <option value="">Select a boat</option>
                {boatsData.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name} (Capacity: {boat.capacity})
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Custom Max Capacity (Optional)">
              <Input
                type="number"
                value={maxCapacity || ""}
                onChange={(e) =>
                  setMaxCapacity(
                    e.target.value
                      ? Number.parseInt(e.target.value)
                      : undefined,
                  )
                }
                min={1}
              />
            </Field>

            <Flex justify="flex-end" gap={2}>
              <Button size="sm" onClick={() => setIsAddingBoat(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={handleAddBoat}
                disabled={!selectedBoatId}
              >
                Add Boat
              </Button>
            </Flex>
          </VStack>
        ) : (
          <Button onClick={() => setIsAddingBoat(true)} size="sm" mb={4}>
            <FiPlus style={{ marginRight: "4px" }} />
            Add Boat
          </Button>
        )}
      </Box>

      <ReassignPassengersDialog
        reassignFrom={reassignFrom}
        reassignToBoatId={reassignToBoatId}
        reassignTypeMapping={reassignTypeMapping}
        isSubmitting={isReassignSubmitting}
        canSubmit={reassignCanSubmit}
        tripBoats={tripBoats}
        boatsMap={boatsMap}
        onClose={() => {
          setReassignFrom(null)
          setReassignToBoatId("")
          setReassignTypeMapping({})
        }}
        onTargetBoatChange={setReassignToBoatId}
        onTypeMappingChange={setReassignTypeMapping}
        onConfirm={handleReassignConfirm}
      />
    </>
  )
}

export default BoatsTab
