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
  MerchandiseService,
  type TripMerchandiseCreate,
  type TripMerchandisePublic,
  TripMerchandiseService,
  type TripMerchandiseUpdate,
  type TripPricingCreate,
  type TripPricingPublic,
  TripPricingService,
  type TripPricingUpdate,
} from "@/client"
import { NativeSelect } from "@/components/ui/native-select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface TripPricingManagerProps {
  tripId: string
}


export default function TripPricingManager({
  tripId,
}: TripPricingManagerProps) {
  const [isAddingPricing, setIsAddingPricing] = useState(false)
  const [isAddingMerchandise, setIsAddingMerchandise] = useState(false)
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null)
  const [editingMerchandiseId, setEditingMerchandiseId] = useState<
    string | null
  >(null)

  // Form states for pricing
  const [pricingForm, setPricingForm] = useState({
    ticket_type: "",
    price: "",
  })

  // Form states for merchandise (catalog selection + optional overrides)
  const [merchandiseForm, setMerchandiseForm] = useState({
    merchandise_id: "",
    price_override: "",
    quantity_available_override: "",
  })

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Fetch trip pricing
  const { data: pricingData, refetch: refetchPricing } = useQuery({
    queryKey: ["trip-pricing", tripId],
    queryFn: () => TripPricingService.listTripPricing({ tripId }),
  })

  // Fetch trip merchandise
  const { data: merchandiseData, refetch: refetchMerchandise } = useQuery({
    queryKey: ["trip-merchandise", tripId],
    queryFn: () => TripMerchandiseService.listTripMerchandise({ tripId }),
  })

  // Fetch catalog merchandise for dropdown
  const { data: catalogMerchandise } = useQuery({
    queryKey: ["merchandise-catalog"],
    queryFn: () =>
      MerchandiseService.readMerchandiseList({ limit: 500, skip: 0 }),
  })

  // Create pricing mutation
  const createPricingMutation = useMutation({
    mutationFn: (data: TripPricingCreate) =>
      TripPricingService.createTripPricing({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Pricing created successfully")
      setIsAddingPricing(false)
      setPricingForm({ ticket_type: "", price: "" })
      refetchPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-pricing"] })
    },
    onError: handleError,
  })

  // Update pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TripPricingUpdate }) =>
      TripPricingService.updateTripPricing({
        tripPricingId: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Pricing updated successfully")
      setEditingPricingId(null)
      setPricingForm({ ticket_type: "", price: "" })
      refetchPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-pricing"] })
    },
    onError: handleError,
  })

  // Delete pricing mutation
  const deletePricingMutation = useMutation({
    mutationFn: (id: string) =>
      TripPricingService.deleteTripPricing({ tripPricingId: id }),
    onSuccess: () => {
      showSuccessToast("Pricing deleted successfully")
      refetchPricing()
      queryClient.invalidateQueries({ queryKey: ["trip-pricing"] })
    },
    onError: handleError,
  })

  // Create merchandise mutation
  const createMerchandiseMutation = useMutation({
    mutationFn: (data: TripMerchandiseCreate) =>
      TripMerchandiseService.createTripMerchandise({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Merchandise created successfully")
      setIsAddingMerchandise(false)
      setMerchandiseForm({
        merchandise_id: "",
        price_override: "",
        quantity_available_override: "",
      })
      refetchMerchandise()
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
    },
    onError: handleError,
  })

  // Update merchandise mutation
  const updateMerchandiseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TripMerchandiseUpdate }) =>
      TripMerchandiseService.updateTripMerchandise({
        tripMerchandiseId: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Merchandise updated successfully")
      setEditingMerchandiseId(null)
      setMerchandiseForm({
        merchandise_id: "",
        price_override: "",
        quantity_available_override: "",
      })
      refetchMerchandise()
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
    },
    onError: handleError,
  })

  // Delete merchandise mutation
  const deleteMerchandiseMutation = useMutation({
    mutationFn: (id: string) =>
      TripMerchandiseService.deleteTripMerchandise({ tripMerchandiseId: id }),
    onSuccess: () => {
      showSuccessToast("Merchandise deleted successfully")
      refetchMerchandise()
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
    },
    onError: handleError,
  })

  const handlePricingSubmit = () => {
    if (!pricingForm.ticket_type.trim() || !pricingForm.price) return

    // Check for duplicate ticket type (only when creating, not when editing)
    if (!editingPricingId) {
      const exists = pricingData?.some(
        (p) =>
          p.ticket_type.toLowerCase().trim() ===
          pricingForm.ticket_type.toLowerCase().trim(),
      )
      if (exists) {
        showErrorToast("This ticket type already exists for this trip")
        return
      }
    }

    const data: TripPricingCreate = {
      trip_id: tripId,
      ticket_type: pricingForm.ticket_type,
      price: Number.parseFloat(pricingForm.price),
    }

    if (editingPricingId) {
      updatePricingMutation.mutate({ id: editingPricingId, data })
    } else {
      createPricingMutation.mutate(data)
    }
  }

  const handleMerchandiseSubmit = () => {
    if (!merchandiseForm.merchandise_id && !editingMerchandiseId) return

    if (editingMerchandiseId) {
      const data: TripMerchandiseUpdate = {
        price_override: merchandiseForm.price_override
          ? Number.parseFloat(merchandiseForm.price_override)
          : null,
        quantity_available_override: merchandiseForm.quantity_available_override
          ? Number.parseInt(merchandiseForm.quantity_available_override, 10)
          : null,
      }
      updateMerchandiseMutation.mutate({ id: editingMerchandiseId, data })
    } else {
      const data: TripMerchandiseCreate = {
        trip_id: tripId,
        merchandise_id: merchandiseForm.merchandise_id,
        price_override: merchandiseForm.price_override
          ? Number.parseFloat(merchandiseForm.price_override)
          : null,
        quantity_available_override: merchandiseForm.quantity_available_override
          ? Number.parseInt(merchandiseForm.quantity_available_override, 10)
          : null,
      }
      createMerchandiseMutation.mutate(data)
    }
  }

  const startEditPricing = (pricing: TripPricingPublic) => {
    setEditingPricingId(pricing.id)
    setPricingForm({
      ticket_type: pricing.ticket_type,
      price: pricing.price.toString(),
    })
  }

  const startEditMerchandise = (merchandise: TripMerchandisePublic) => {
    setEditingMerchandiseId(merchandise.id)
    setMerchandiseForm({
      merchandise_id: merchandise.merchandise_id,
      price_override:
        merchandise.price != null ? merchandise.price.toString() : "",
      quantity_available_override:
        merchandise.quantity_available != null
          ? merchandise.quantity_available.toString()
          : "",
    })
  }

  const cancelEdit = () => {
    setEditingPricingId(null)
    setEditingMerchandiseId(null)
    setIsAddingPricing(false)
    setIsAddingMerchandise(false)
    setPricingForm({ ticket_type: "", price: "" })
    setMerchandiseForm({
      merchandise_id: "",
      price_override: "",
      quantity_available_override: "",
    })
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Trip Pricing Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="bold" fontSize="lg">
            Ticket Pricing
          </Text>
          {!isAddingPricing && !editingPricingId && (
            <Button size="sm" onClick={() => setIsAddingPricing(true)}>
              <FiPlus style={{ marginRight: "4px" }} />
              Add Pricing
            </Button>
          )}
        </HStack>

        {/* Add/Edit Pricing Form */}
        {(isAddingPricing || editingPricingId) && (
          <Box p={4} borderWidth="1px" borderRadius="md" mb={4}>
            <VStack gap={3}>
              <HStack width="100%">
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Ticket Type
                  </Text>
                  <Input
                    value={pricingForm.ticket_type}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        ticket_type: e.target.value,
                      })
                    }
                    placeholder="e.g., Adult, Child, VIP, Standard"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Price ($)
                  </Text>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.price}
                    onChange={(e) =>
                      setPricingForm({ ...pricingForm, price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </Box>
              </HStack>
              <HStack width="100%" justify="flex-end">
                <Button size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handlePricingSubmit}
                  disabled={
                    !pricingForm.ticket_type.trim() ||
                    !pricingForm.price ||
                    createPricingMutation.isPending ||
                    updatePricingMutation.isPending
                  }
                  loading={
                    createPricingMutation.isPending ||
                    updatePricingMutation.isPending
                  }
                >
                  {editingPricingId ? "Update" : "Add"} Pricing
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {/* Pricing List */}
        <VStack align="stretch" gap={2}>
          {pricingData?.map((pricing) => (
            <HStack
              key={pricing.id}
              justify="space-between"
              p={3}
              borderWidth="1px"
              borderRadius="md"
            >
              <HStack>
                <Text fontWeight="medium" color={editingPricingId === pricing.id ? "white" : "inherit"}>
                  {pricing.ticket_type}
                </Text>
                <Text color={editingPricingId === pricing.id ? "white" : "inherit"}>${pricing.price.toFixed(2)}</Text>
              </HStack>
              <HStack>
                {editingPricingId !== pricing.id && (
                  <IconButton
                    aria-label="Edit pricing"
                    children={<FiEdit />}
                    size="sm"
                    variant="ghost"
                    color={editingPricingId === pricing.id ? "white" : "inherit"}
                    onClick={() => startEditPricing(pricing)}
                  />
                )}
                <IconButton
                  aria-label="Delete pricing"
                  children={<FiTrash2 />}
                  size="sm"
                  variant="ghost"
                  colorScheme={editingPricingId === pricing.id ? "white" : "red"}
                  onClick={() => deletePricingMutation.mutate(pricing.id)}
                  loading={deletePricingMutation.isPending}
                />
              </HStack>
            </HStack>
          ))}
          {(!pricingData || pricingData.length === 0) && (
            <Text color="gray.500" textAlign="center" py={4}>
              No pricing configured for this trip
            </Text>
          )}
        </VStack>
      </Box>

      {/* Trip Merchandise Section */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <Text fontWeight="bold" fontSize="lg">
            Merchandise
          </Text>
          {!isAddingMerchandise && !editingMerchandiseId && (
            <Button size="sm" onClick={() => setIsAddingMerchandise(true)}>
              <FiPlus style={{ marginRight: "4px" }} />
              Add Merchandise
            </Button>
          )}
        </HStack>

        {/* Add/Edit Merchandise Form (catalog selection + optional overrides) */}
        {(isAddingMerchandise || editingMerchandiseId) && (
          <Box p={4} borderWidth="1px" borderRadius="md" mb={4}>
            <VStack gap={3}>
              {editingMerchandiseId ? (
                <Text fontSize="sm" width="100%">
                  Editing overrides for this trip. Catalog item cannot be changed.
                </Text>
              ) : (
                <HStack width="100%">
                  <Box flex={1}>
                    <Text fontSize="sm" mb={1}>
                      Catalog item
                    </Text>
                    <NativeSelect
                      value={merchandiseForm.merchandise_id}
                      onChange={(e) =>
                        setMerchandiseForm({
                          ...merchandiseForm,
                          merchandise_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select merchandise</option>
                      {catalogMerchandise?.data.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — ${m.price.toFixed(2)} (qty {m.quantity_available})
                        </option>
                      ))}
                    </NativeSelect>
                  </Box>
                </HStack>
              )}
              <HStack width="100%">
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Price override ($, optional)
                  </Text>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={merchandiseForm.price_override}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        price_override: e.target.value,
                      })
                    }
                    placeholder="Use catalog price"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Quantity override (optional)
                  </Text>
                  <Input
                    type="number"
                    min="0"
                    value={merchandiseForm.quantity_available_override}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        quantity_available_override: e.target.value,
                      })
                    }
                    placeholder="Use catalog qty"
                  />
                </Box>
              </HStack>
              <HStack width="100%" justify="flex-end">
                <Button size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleMerchandiseSubmit}
                  disabled={
                    (!editingMerchandiseId && !merchandiseForm.merchandise_id) ||
                    createMerchandiseMutation.isPending ||
                    updateMerchandiseMutation.isPending
                  }
                  loading={
                    createMerchandiseMutation.isPending ||
                    updateMerchandiseMutation.isPending
                  }
                >
                  {editingMerchandiseId ? "Update" : "Add"} Merchandise
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {/* Merchandise List */}
        <VStack align="stretch" gap={2}>
          {merchandiseData?.map((merchandise) => (
            <HStack
              key={merchandise.id}
              justify="space-between"
              p={3}
              borderWidth="1px"
              borderRadius="md"
              bg={
                editingMerchandiseId === merchandise.id
                  ? "blue.500"
                  : "transparent"
              }
            >
              <VStack align="start" flex={1}>
                <Text fontWeight="medium" color={editingMerchandiseId === merchandise.id ? "white" : "inherit"}>{merchandise.name}</Text>
                {merchandise.description && (
                  <Text fontSize="sm" color={editingMerchandiseId === merchandise.id ? "gray.200" : "gray.600"}>
                    {merchandise.description}
                  </Text>
                )}
                <HStack>
                  <Text fontSize="sm" color={editingMerchandiseId === merchandise.id ? "white" : "inherit"}>${merchandise.price.toFixed(2)}</Text>
                  <Text fontSize="sm" color={editingMerchandiseId === merchandise.id ? "gray.200" : "gray.500"}>
                    ({merchandise.quantity_available} available)
                  </Text>
                </HStack>
              </VStack>
              <HStack>
                {editingMerchandiseId !== merchandise.id && (
                  <IconButton
                    aria-label="Edit merchandise"
                    children={<FiEdit />}
                    size="sm"
                    variant="ghost"
                    color={editingMerchandiseId === merchandise.id ? "white" : "inherit"}
                    onClick={() => startEditMerchandise(merchandise)}
                  />
                )}
                <IconButton
                  aria-label="Delete merchandise"
                  children={<FiTrash2 />}
                  size="sm"
                  variant="ghost"
                  colorScheme={editingMerchandiseId === merchandise.id ? "white" : "red"}
                  onClick={() =>
                    deleteMerchandiseMutation.mutate(merchandise.id)
                  }
                  loading={deleteMerchandiseMutation.isPending}
                />
              </HStack>
            </HStack>
          ))}
          {(!merchandiseData || merchandiseData.length === 0) && (
            <Text color="gray.500" textAlign="center" py={4}>
              No merchandise configured for this trip
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  )
}
