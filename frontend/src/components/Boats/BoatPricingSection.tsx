import { type ApiError, BoatPricingService } from "@/client"
import type { Boat } from "@/types/boat"
import { formatCents, handleError } from "@/utils"
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
import { useState } from "react"
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi"

import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

function sumConstrainedBoatCapacities(
  rows: Array<{ capacity?: number | null }>,
): number {
  return rows.reduce(
    (sum, p) => sum + (p.capacity != null ? p.capacity : 0),
    0,
  )
}

interface BoatPricingSectionProps {
  boat: Boat
  effectiveCapacity: number
  isOpen: boolean
}

export default function BoatPricingSection({
  boat,
  effectiveCapacity,
  isOpen,
}: BoatPricingSectionProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [isAddingPricing, setIsAddingPricing] = useState(false)
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null)
  const [editPricingForm, setEditPricingForm] = useState({
    ticket_type: "",
    price: "",
    capacity: "",
  })
  const [pricingForm, setPricingForm] = useState({
    ticket_type: "",
    price: "",
    capacity: "",
  })
  const [renamePricingConfirmOpen, setRenamePricingConfirmOpen] =
    useState(false)
  const [pendingRenamePricingPayload, setPendingRenamePricingPayload] =
    useState<{
      boatPricingId: string
      ticket_type?: string
      price: number
      capacity: number | null
    } | null>(null)

  const { data: boatPricingList = [], refetch: refetchBoatPricing } = useQuery({
    queryKey: ["boat-pricing", boat.id],
    queryFn: () => BoatPricingService.listBoatPricing({ boatId: boat.id }),
    enabled: isOpen && !!boat.id,
  })

  const createPricingMutation = useMutation({
    mutationFn: (body: {
      ticket_type: string
      price: number
      capacity: number | null
    }) =>
      BoatPricingService.createBoatPricing({
        requestBody: {
          boat_id: boat.id,
          ticket_type: body.ticket_type,
          price: body.price,
          ...(body.capacity != null ? { capacity: body.capacity } : {}),
        },
      }),
    onSuccess: () => {
      showSuccessToast("Ticket type added.")
      setPricingForm({ ticket_type: "", price: "", capacity: "" })
      setIsAddingPricing(false)
      refetchBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["boat-pricing"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const updatePricingMutation = useMutation({
    mutationFn: (body: {
      boatPricingId: string
      ticket_type?: string
      price: number
      capacity: number | null
    }) =>
      BoatPricingService.updateBoatPricing({
        boatPricingId: body.boatPricingId,
        requestBody: {
          ticket_type: body.ticket_type,
          price: body.price,
          capacity: body.capacity,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Ticket type updated. Existing bookings updated.")
      setEditingPricingId(null)
      setEditPricingForm({ ticket_type: "", price: "", capacity: "" })
      refetchBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["boat-pricing"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boat-pricing"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const deletePricingMutation = useMutation({
    mutationFn: (boatPricingId: string) =>
      BoatPricingService.deleteBoatPricing({ boatPricingId }),
    onSuccess: () => {
      showSuccessToast("Ticket type removed.")
      refetchBoatPricing()
      queryClient.invalidateQueries({ queryKey: ["boat-pricing"] })
    },
    onError: (err: ApiError) => handleError(err),
  })

  const handleAddPricing = () => {
    const priceDollars = Number.parseFloat(pricingForm.price)
    const capTrim = pricingForm.capacity.trim()
    const cap = capTrim === "" ? null : Number.parseInt(capTrim, 10)
    if (
      !pricingForm.ticket_type.trim() ||
      Number.isNaN(priceDollars) ||
      (cap !== null && (Number.isNaN(cap) || cap < 0))
    )
      return
    const totalAllocated =
      sumConstrainedBoatCapacities(boatPricingList) + (cap ?? 0)
    if (totalAllocated > effectiveCapacity) {
      handleError({
        body: {
          detail: `Sum of ticket-type capacities (${totalAllocated}) would exceed boat capacity (${effectiveCapacity})`,
        },
      } as ApiError)
      return
    }
    createPricingMutation.mutate({
      ticket_type: pricingForm.ticket_type.trim(),
      price: Math.round(priceDollars * 100),
      capacity: cap,
    })
  }

  return (
    <>
      <Box width="100%">
        <Text fontWeight="bold" mb={2}>
          Ticket types (default pricing)
        </Text>
        <Text fontSize="sm" color="gray.400" mb={2}>
          Default ticket types and prices for this boat. Trips can override per
          boat.
        </Text>
        {boatPricingList.length > 0 && (
          <Text fontSize="xs" color="gray.500" mb={2}>
            {sumConstrainedBoatCapacities(boatPricingList)} of{" "}
            {effectiveCapacity} fixed seats allocated
          </Text>
        )}
        {isAddingPricing ? (
          <VStack
            align="stretch"
            gap={2}
            mb={3}
            p={3}
            borderWidth="1px"
            borderRadius="md"
          >
            <HStack width="100%" gap={2} flexWrap="wrap">
              <Box flex={1} minW="120px">
                <Text fontSize="sm" mb={1}>
                  Ticket type
                </Text>
                <Input
                  value={pricingForm.ticket_type}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      ticket_type: e.target.value,
                    })
                  }
                  placeholder="e.g. Adult, Child"
                />
              </Box>
              <Box flex={1} minW="80px">
                <Text fontSize="sm" mb={1}>
                  Price ($)
                </Text>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricingForm.price}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      price: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </Box>
              <Box flex={1} minW="80px">
                <Text fontSize="sm" mb={1}>
                  Capacity (optional)
                </Text>
                <Input
                  type="number"
                  min="0"
                  value={pricingForm.capacity}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      capacity: e.target.value,
                    })
                  }
                  placeholder="Shared boat"
                />
              </Box>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              Leave empty so this type shares the boat limit. Sum of fixed
              slices must not exceed {effectiveCapacity}.
            </Text>
            <HStack width="100%" justify="flex-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAddingPricing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddPricing}
                loading={createPricingMutation.isPending}
                disabled={
                  !pricingForm.ticket_type.trim() ||
                  !pricingForm.price ||
                  Number.isNaN(Number.parseFloat(pricingForm.price)) ||
                  (pricingForm.capacity.trim() !== "" &&
                    (Number.isNaN(
                      Number.parseInt(pricingForm.capacity, 10),
                    ) ||
                      Number.parseInt(pricingForm.capacity, 10) < 0))
                }
              >
                Add
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Button
            size="sm"
            variant="outline"
            mb={2}
            onClick={() => {
              setEditingPricingId(null)
              setIsAddingPricing(true)
            }}
          >
            <FiPlus style={{ marginRight: "4px" }} />
            Add ticket type
          </Button>
        )}
        <VStack align="stretch" gap={2}>
          {boatPricingList.map((p) =>
            editingPricingId === p.id ? (
              <VStack
                key={p.id}
                align="stretch"
                gap={2}
                p={3}
                borderWidth="1px"
                borderRadius="md"
              >
                <HStack width="100%" gap={2} flexWrap="wrap">
                  <Box flex={1} minW="120px">
                    <Text fontSize="sm" mb={1}>
                      Ticket type
                    </Text>
                    <Input
                      value={editPricingForm.ticket_type}
                      onChange={(e) =>
                        setEditPricingForm((prev) => ({
                          ...prev,
                          ticket_type: e.target.value,
                        }))
                      }
                      placeholder="e.g. Adult, Child"
                    />
                  </Box>
                  <Box flex={1} minW="80px">
                    <Text fontSize="sm" mb={1}>
                      Price ($)
                    </Text>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPricingForm.price}
                      onChange={(e) =>
                        setEditPricingForm((prev) => ({
                          ...prev,
                          price: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </Box>
                  <Box flex={1} minW="80px">
                    <Text fontSize="sm" mb={1}>
                      Capacity (optional)
                    </Text>
                    <Input
                      type="number"
                      min="0"
                      value={editPricingForm.capacity}
                      onChange={(e) =>
                        setEditPricingForm((prev) => ({
                          ...prev,
                          capacity: e.target.value,
                        }))
                      }
                      placeholder="Shared boat"
                    />
                  </Box>
                </HStack>
                <HStack width="100%" justify="flex-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingPricingId(null)
                      setEditPricingForm({
                        ticket_type: "",
                        price: "",
                        capacity: "",
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const ticketType =
                        editPricingForm.ticket_type.trim()
                      const priceDollars = Number.parseFloat(
                        editPricingForm.price,
                      )
                      const capTrim = editPricingForm.capacity.trim()
                      const cap =
                        capTrim === ""
                          ? null
                          : Number.parseInt(capTrim, 10)
                      if (
                        !ticketType ||
                        Number.isNaN(priceDollars) ||
                        (cap !== null && (Number.isNaN(cap) || cap < 0))
                      ) {
                        return
                      }
                      const otherSum = sumConstrainedBoatCapacities(
                        boatPricingList.filter((bp) => bp.id !== p.id),
                      )
                      const totalAllocated = otherSum + (cap ?? 0)
                      if (totalAllocated > effectiveCapacity) {
                        handleError({
                          body: {
                            detail: `Sum of ticket-type capacities (${totalAllocated}) would exceed boat capacity (${effectiveCapacity})`,
                          },
                        } as ApiError)
                        return
                      }
                      const payload = {
                        boatPricingId: p.id,
                        ticket_type: ticketType,
                        price: Math.round(priceDollars * 100),
                        capacity: cap,
                      }
                      const isRename = ticketType !== p.ticket_type
                      if (isRename) {
                        setPendingRenamePricingPayload(payload)
                        setRenamePricingConfirmOpen(true)
                      } else {
                        updatePricingMutation.mutate(payload)
                      }
                    }}
                    loading={updatePricingMutation.isPending}
                  >
                    Save
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <HStack
                key={p.id}
                justify="space-between"
                p={2}
                borderWidth="1px"
                borderRadius="md"
              >
                <HStack>
                  <Text fontWeight="medium">{p.ticket_type}</Text>
                  <Text fontSize="sm" color="gray.400">
                    ${formatCents(p.price)}
                    {p.capacity != null
                      ? ` (${p.capacity} seats)`
                      : " (shared boat)"}
                  </Text>
                </HStack>
                <HStack>
                  <IconButton
                    aria-label="Edit ticket type"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingPricing(false)
                      setEditingPricingId(p.id)
                      setEditPricingForm({
                        ticket_type: p.ticket_type,
                        price: (p.price / 100).toFixed(2),
                        capacity:
                          p.capacity != null ? String(p.capacity) : "",
                      })
                    }}
                    disabled={
                      updatePricingMutation.isPending ||
                      deletePricingMutation.isPending
                    }
                  >
                    <FiEdit />
                  </IconButton>
                  <IconButton
                    aria-label="Remove ticket type"
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => deletePricingMutation.mutate(p.id)}
                    disabled={deletePricingMutation.isPending}
                  >
                    <FiTrash2 />
                  </IconButton>
                </HStack>
              </HStack>
            ),
          )}
          {boatPricingList.length === 0 && !isAddingPricing && (
            <Text fontSize="sm" color="gray.500" py={2}>
              No ticket types. Add trip boats and pricing on each trip, or set
              defaults here.
            </Text>
          )}
        </VStack>
      </Box>

      <DialogRoot
        size="xs"
        placement="center"
        open={renamePricingConfirmOpen}
        onOpenChange={({ open }) => {
          if (!open) {
            setRenamePricingConfirmOpen(false)
            setPendingRenamePricingPayload(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename ticket type</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>
              This will update all existing bookings with this ticket type to
              use the new name. Continue?
            </Text>
          </DialogBody>
          <DialogFooter gap={2}>
            <Button
              variant="ghost"
              onClick={() => {
                setRenamePricingConfirmOpen(false)
                setPendingRenamePricingPayload(null)
              }}
              disabled={updatePricingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={() => {
                if (pendingRenamePricingPayload) {
                  updatePricingMutation.mutate(pendingRenamePricingPayload, {
                    onSettled: () => {
                      setRenamePricingConfirmOpen(false)
                      setPendingRenamePricingPayload(null)
                    },
                  })
                }
              }}
              loading={updatePricingMutation.isPending}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  )
}
