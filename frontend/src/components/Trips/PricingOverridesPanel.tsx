import { NativeSelect } from "@/components/ui/native-select"
import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi"

import {
  type ApiError,
  BoatPricingService,
  TripBoatPricingService,
} from "@/client"
import RenamePricingConfirmDialog from "@/components/Trips/RenamePricingConfirmDialog"
import { Field } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents, handleError } from "@/utils"

export interface RequestDeletePricingParams {
  tripBoatPricingId: string
  ticketType: string
  boatId: string
  boatName: string
  tripBoatId: string
  usedCount: number
  allTypesOnBoat: string[]
}

interface PricingOverridesPanelProps {
  tripBoatId: string
  boatId: string
  boatName: string
  tripId: string
  isOpen: boolean
  tripBoats: any[]
  boatsMap: Map<string, any>
  onClose: () => void
  onPendingChange: (hasPending: boolean) => void
  onToggleUseOnlyTripPricing: (checked: boolean) => void
  isUpdatingTripBoat: boolean
  useOnlyTripPricing: boolean
  onRequestDeletePricing?: (params: RequestDeletePricingParams) => void
}

const PricingOverridesPanel = ({
  tripBoatId,
  boatId,
  boatName,
  tripId,
  isOpen,
  tripBoats,
  boatsMap,
  onClose,
  onPendingChange,
  onToggleUseOnlyTripPricing,
  isUpdatingTripBoat,
  useOnlyTripPricing,
  onRequestDeletePricing,
}: PricingOverridesPanelProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null)
  const [editingOverrideTicketType, setEditingOverrideTicketType] = useState("")
  const [editingOverridePrice, setEditingOverridePrice] = useState("")
  const [editingOverrideCapacity, setEditingOverrideCapacity] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ ticket_type: "", price: "", capacity: "" })
  const [renamePricingConfirmOpen, setRenamePricingConfirmOpen] = useState(false)
  const [pendingRenamePricingPayload, setPendingRenamePricingPayload] =
    useState<{
      tripBoatPricingId: string
      ticket_type?: string
      price: number
      capacity: number | null
    } | null>(null)
  const [renamePricingAffectedCount, setRenamePricingAffectedCount] = useState(0)
  const [renamePricingOldType, setRenamePricingOldType] = useState("")

  const hasPending = isAdding || editingOverrideId !== null

  useEffect(() => {
    onPendingChange(hasPending)
  }, [hasPending, onPendingChange])

  useEffect(() => {
    setEditingOverrideId(null)
    setEditingOverridePrice("")
  }, [tripBoatId])

  const { data: boatDefaultsList = [] } = useQuery({
    queryKey: ["boat-pricing", boatId],
    queryFn: () => BoatPricingService.listBoatPricing({ boatId }),
    enabled: isOpen && !!boatId,
  })

  const { data: tripBoatPricingList = [], refetch: refetchTripBoatPricing } =
    useQuery({
      queryKey: ["trip-boat-pricing", tripBoatId],
      queryFn: () =>
        TripBoatPricingService.listTripBoatPricing({ tripBoatId }),
      enabled: isOpen && !!tripBoatId,
    })

  const createMutation = useMutation({
    mutationFn: (body: {
      ticket_type: string
      price: number
      capacity?: number | null
    }) =>
      TripBoatPricingService.createTripBoatPricing({
        requestBody: {
          trip_boat_id: tripBoatId,
          ticket_type: body.ticket_type,
          price: body.price,
          capacity: body.capacity ?? undefined,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Pricing override added.")
      setForm({ ticket_type: "", price: "", capacity: "" })
      setIsAdding(false)
      refetchTripBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-boat-pricing"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      TripBoatPricingService.deleteTripBoatPricing({ tripBoatPricingId: id }),
    onSuccess: () => {
      showSuccessToast("Pricing override removed.")
      refetchTripBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-boat-pricing"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const updateMutation = useMutation({
    mutationFn: (body: {
      tripBoatPricingId: string
      ticket_type?: string
      price: number
      capacity: number | null
    }) =>
      TripBoatPricingService.updateTripBoatPricing({
        tripBoatPricingId: body.tripBoatPricingId,
        requestBody: {
          ticket_type: body.ticket_type,
          price: body.price,
          capacity: body.capacity,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Override updated. Existing bookings updated.")
      setEditingOverrideId(null)
      setEditingOverrideTicketType("")
      setEditingOverridePrice("")
      setEditingOverrideCapacity("")
      refetchTripBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-boat-pricing"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats-for-edit", tripId] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const selectedTripBoat = tripBoats.find((tb) => tb.id === tripBoatId) ?? null

  const handleAdd = () => {
    const priceDollars = Number.parseFloat(form.price)
    const cap = form.capacity.trim()
      ? Number.parseInt(form.capacity, 10)
      : null
    if (!form.ticket_type.trim() || Number.isNaN(priceDollars)) return
    if (cap !== null && (Number.isNaN(cap) || cap < 0)) return
    createMutation.mutate({
      ticket_type: form.ticket_type.trim(),
      price: Math.round(priceDollars * 100),
      capacity: cap ?? undefined,
    })
  }

  const handleSaveEdit = (pricingId: string, originalTicketType: string) => {
    const ticketType = editingOverrideTicketType.trim()
    const cents = Math.round(Number.parseFloat(editingOverridePrice) * 100)
    if (!ticketType || Number.isNaN(cents) || cents < 0) return
    const cap = editingOverrideCapacity.trim()
      ? Number.parseInt(editingOverrideCapacity, 10)
      : null
    if (cap !== null && (Number.isNaN(cap) || cap < 0)) return
    const payload = {
      tripBoatPricingId: pricingId,
      ticket_type: ticketType,
      price: cents,
      capacity: cap,
    }
    const isRename = ticketType !== originalTicketType
    const usedCount =
      selectedTripBoat && "used_per_ticket_type" in selectedTripBoat
        ? (
            selectedTripBoat as {
              used_per_ticket_type?: Record<string, number>
            }
          ).used_per_ticket_type?.[originalTicketType] ?? 0
        : 0
    if (isRename && usedCount > 0) {
      setRenamePricingAffectedCount(usedCount)
      setRenamePricingOldType(originalTicketType)
      setPendingRenamePricingPayload(payload)
      setRenamePricingConfirmOpen(true)
    } else {
      updateMutation.mutate(payload)
    }
  }

  return (
    <>
      <Box
        mt={2}
        ml={2}
        p={3}
        borderWidth="1px"
        borderRadius="md"
        borderColor="gray.400"
        _dark={{ borderColor: "gray.600" }}
      >
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold">
            Pricing overrides for {boatName}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            onClick={onClose}
          >
            Close
          </Button>
        </HStack>
        <HStack
          justify="space-between"
          align="center"
          mb={2}
          p={2}
          borderWidth="1px"
          borderRadius="md"
          borderColor="gray.300"
          _dark={{ borderColor: "gray.600" }}
        >
          <Box>
            <Text fontSize="sm" fontWeight="medium">
              Use only trip-specific pricing
            </Text>
            <Text fontSize="xs" color="gray.500">
              {useOnlyTripPricing
                ? "Boat defaults ignored. Define all ticket types below."
                : "Boat defaults apply; overrides replace price/capacity."}
            </Text>
          </Box>
          <Switch
            checked={useOnlyTripPricing}
            onCheckedChange={({ checked }) =>
              onToggleUseOnlyTripPricing(checked)
            }
            disabled={isUpdatingTripBoat}
          />
        </HStack>
        <Text fontSize="xs" color="gray.400" mb={2}>
          {useOnlyTripPricing
            ? "Define all ticket types for this trip. Boat defaults are ignored."
            : "Boat defaults apply unless you add an override for this trip. Overrides replace the default price for that ticket type."}
        </Text>
        {!useOnlyTripPricing && (
          <Box mb={3}>
            <Text fontSize="sm" fontWeight="bold" mb={2} color="gray.500">
              Boat defaults (Edit Boat to change)
            </Text>
            {boatDefaultsList.length > 0 ? (
              <VStack align="stretch" gap={1}>
                {boatDefaultsList.map((bp) => (
                  <HStack
                    key={bp.id}
                    justify="space-between"
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor="gray.400"
                    _dark={{ borderColor: "gray.600", bg: "gray.700/40" }}
                  >
                    <Text fontSize="sm">{bp.ticket_type}</Text>
                    <Text fontSize="sm" color="gray.400">
                      ${formatCents(bp.price)} ({bp.capacity} seats)
                    </Text>
                  </HStack>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color="gray.500">
                No defaults. Add ticket types in Edit Boat.
              </Text>
            )}
          </Box>
        )}
        <Text
          fontSize="sm"
          fontWeight="bold"
          mb={2}
          color="gray.700"
          _dark={{ color: "gray.300" }}
        >
          {useOnlyTripPricing
            ? "Ticket types for this trip"
            : "Overrides for this trip"}
        </Text>
        <VStack align="stretch" gap={2}>
          {tripBoatPricingList.map((p) => {
            const isEditing = editingOverrideId === p.id
            return (
              <Box
                key={p.id}
                p={2}
                borderWidth="1px"
                borderRadius="md"
                borderColor="gray.600"
              >
                {isEditing ? (
                  <VStack align="stretch" gap={2} width="100%" minWidth={0}>
                    <HStack gap={2} flexWrap="wrap" align="flex-end">
                      <Field label="Ticket type" flex="1 1 120px" minWidth="100px">
                        <Input
                          size="sm"
                          value={editingOverrideTicketType}
                          onChange={(e) =>
                            setEditingOverrideTicketType(e.target.value)
                          }
                          placeholder="e.g. VIP, Premium"
                        />
                      </Field>
                      <Field label="Price ($)" flex="1 1 80px" minWidth="70px">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          size="sm"
                          value={editingOverridePrice}
                          onChange={(e) =>
                            setEditingOverridePrice(e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label="Capacity (opt)" flex="1 1 70px" minWidth="60px">
                        <Input
                          type="number"
                          min="0"
                          size="sm"
                          value={editingOverrideCapacity}
                          onChange={(e) =>
                            setEditingOverrideCapacity(e.target.value)
                          }
                          placeholder="—"
                          title="Capacity override (optional)"
                        />
                      </Field>
                    </HStack>
                    <HStack justify="flex-end" gap={2}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingOverrideId(null)
                          setEditingOverrideTicketType("")
                          setEditingOverridePrice("")
                          setEditingOverrideCapacity("")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => handleSaveEdit(p.id, p.ticket_type)}
                        loading={updateMutation.isPending}
                        disabled={
                          !editingOverrideTicketType.trim() ||
                          !editingOverridePrice ||
                          Number.isNaN(
                            Number.parseFloat(editingOverridePrice),
                          )
                        }
                      >
                        Save
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <HStack
                    justify="space-between"
                    align="center"
                    flex={1}
                    gap={2}
                  >
                    <HStack gap={2} flex={1} minWidth={0}>
                      <Text fontWeight="medium">{p.ticket_type}</Text>
                      <Text fontSize="sm" color="gray.500">
                        ${formatCents(p.price)}
                        {!useOnlyTripPricing && " (override)"}
                        {p.capacity != null ? `, ${p.capacity} seats` : ""}
                      </Text>
                    </HStack>
                    <HStack gap={1}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingOverrideId(p.id)
                          setEditingOverrideTicketType(p.ticket_type)
                          setEditingOverridePrice(
                            (p.price / 100).toFixed(2),
                          )
                          setEditingOverrideCapacity(
                            p.capacity != null ? String(p.capacity) : "",
                          )
                        }}
                      >
                        <FiEdit fontSize="12px" />
                        Edit
                      </Button>
                      <IconButton
                        aria-label="Remove override"
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => {
                          const usedCount =
                            selectedTripBoat &&
                            "used_per_ticket_type" in selectedTripBoat
                              ? (
                                  selectedTripBoat as {
                                    used_per_ticket_type?: Record<
                                      string,
                                      number
                                    >
                                  }
                                ).used_per_ticket_type?.[p.ticket_type] ?? 0
                              : 0
                          if (
                            usedCount > 0 &&
                            onRequestDeletePricing != null
                          ) {
                            onRequestDeletePricing({
                              tripBoatPricingId: p.id,
                              ticketType: p.ticket_type,
                              boatId,
                              boatName,
                              tripBoatId,
                              usedCount,
                              allTypesOnBoat: tripBoatPricingList.map(
                                (x) => x.ticket_type,
                              ),
                            })
                          } else {
                            deleteMutation.mutate(p.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </HStack>
                  </HStack>
                )}
              </Box>
            )
          })}
          {tripBoatPricingList.length === 0 && !isAdding && (
            <Text fontSize="sm" color="gray.500" py={2}>
              {useOnlyTripPricing
                ? "No ticket types defined. Add at least one to offer tickets."
                : "No overrides. Boat default pricing applies."}
            </Text>
          )}
        </VStack>
        {isAdding ? (
          <VStack
            align="stretch"
            gap={2}
            mt={3}
            p={2}
            borderWidth="1px"
            borderRadius="md"
          >
            {selectedTripBoat &&
              (() => {
                const tb = tripBoats.find((t) => t.id === selectedTripBoat.id)
                const bboat = tb ? boatsMap.get(tb.boat_id) : null
                const effectiveMax =
                  (tb as { max_capacity?: number })?.max_capacity ??
                  bboat?.capacity ??
                  0
                const allocated = (
                  tripBoatPricingList as Array<{ capacity?: number | null }>
                ).reduce((sum, pr) => sum + (pr.capacity ?? 0), 0)
                const rem = effectiveMax - allocated
                return (
                  <Text fontSize="xs" color="gray.500">
                    Effective max: {effectiveMax} seats. Allocated:{" "}
                    {allocated}. Remaining: {rem}
                  </Text>
                )
              })()}
            <HStack width="100%" align="flex-end">
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Ticket type
                </Text>
                <NativeSelect
                  value={(() => {
                    const defaultsNotOverridden = boatDefaultsList.filter(
                      (bp) =>
                        !tripBoatPricingList.some(
                          (pr) => pr.ticket_type === bp.ticket_type,
                        ),
                    )
                    const isDefault = defaultsNotOverridden.some(
                      (bp) => bp.ticket_type === form.ticket_type,
                    )
                    if (isDefault) return form.ticket_type
                    if (form.ticket_type) return "__other__"
                    return ""
                  })()}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const v = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      ticket_type: v === "__other__" ? "" : v,
                    }))
                  }}
                >
                  <option value="">Select type</option>
                  {boatDefaultsList
                    .filter(
                      (bp) =>
                        !tripBoatPricingList.some(
                          (pr) => pr.ticket_type === bp.ticket_type,
                        ),
                    )
                    .map((bp) => (
                      <option key={bp.id} value={bp.ticket_type}>
                        {bp.ticket_type} (default ${formatCents(bp.price)})
                      </option>
                    ))}
                  <option value="__other__">Other (type below)</option>
                </NativeSelect>
                {(() => {
                  const defaultsNotOverridden = boatDefaultsList.filter(
                    (bp) =>
                      !tripBoatPricingList.some(
                        (pr) => pr.ticket_type === bp.ticket_type,
                      ),
                  )
                  const isDefault =
                    form.ticket_type &&
                    defaultsNotOverridden.some(
                      (bp) => bp.ticket_type === form.ticket_type,
                    )
                  return !isDefault ? (
                    <Input
                      mt={2}
                      size="sm"
                      value={form.ticket_type}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ticket_type: e.target.value,
                        }))
                      }
                      placeholder="e.g. VIP, Premium"
                    />
                  ) : null
                })()}
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Price ($)
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" mb={1}>
                  Capacity (optional)
                </Text>
                <Input
                  type="number"
                  min="0"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                  placeholder="Override seats"
                />
              </Box>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              Leave capacity empty to share boat capacity (no per-type limit).
            </Text>
            <HStack width="100%" justify="flex-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                loading={createMutation.isPending}
                disabled={
                  !form.ticket_type.trim() ||
                  !form.price ||
                  Number.isNaN(Number.parseFloat(form.price))
                }
              >
                {useOnlyTripPricing ? "Add" : "Add override"}
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Button
            size="sm"
            variant="outline"
            mt={2}
            onClick={() => setIsAdding(true)}
          >
            <FiPlus style={{ marginRight: "4px" }} />
            {useOnlyTripPricing ? "Add ticket type" : "Add pricing override"}
          </Button>
        )}
        {tripBoatPricingList.length > 0 && isAdding && (
          <Text fontSize="xs" color="gray.500" mt={1}>
            To change a ticket type already in the list, edit it above
            instead of adding again.
          </Text>
        )}
      </Box>

      <RenamePricingConfirmDialog
        open={renamePricingConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRenamePricingConfirmOpen(false)
            setPendingRenamePricingPayload(null)
          }
        }}
        oldType={renamePricingOldType}
        newType={pendingRenamePricingPayload?.ticket_type}
        affectedCount={renamePricingAffectedCount}
        onConfirm={() => {
          if (pendingRenamePricingPayload) {
            updateMutation.mutate(pendingRenamePricingPayload, {
              onSettled: () => {
                setRenamePricingConfirmOpen(false)
                setPendingRenamePricingPayload(null)
              },
            })
          }
        }}
        mutation={updateMutation}
      />
    </>
  )
}

export default PricingOverridesPanel
