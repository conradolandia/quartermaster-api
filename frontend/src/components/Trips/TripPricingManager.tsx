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
  type TripMerchandiseCreate,
  type TripMerchandisePublic,
  TripMerchandiseService,
  type TripMerchandiseUpdate,
  type TripPricingCreate,
  type TripPricingPublic,
  TripPricingService,
  type TripPricingUpdate,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface TripPricingManagerProps {
  tripId: string
}

const TICKET_TYPES = [
  { value: "adult", label: "Adult" },
  { value: "child", label: "Child" },
  { value: "infant", label: "Infant" },
]

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
    ticket_type: "adult",
    price: "",
  })

  // Form states for merchandise
  const [merchandiseForm, setMerchandiseForm] = useState({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
  })

  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

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

  // Create pricing mutation
  const createPricingMutation = useMutation({
    mutationFn: (data: TripPricingCreate) =>
      TripPricingService.createTripPricing({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Pricing created successfully")
      setIsAddingPricing(false)
      setPricingForm({ ticket_type: "adult", price: "" })
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
      setPricingForm({ ticket_type: "adult", price: "" })
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
        name: "",
        description: "",
        price: "",
        quantity_available: "",
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
        name: "",
        description: "",
        price: "",
        quantity_available: "",
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
    if (!pricingForm.price) return

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
    if (
      !merchandiseForm.name ||
      !merchandiseForm.price ||
      !merchandiseForm.quantity_available
    )
      return

    const data: TripMerchandiseCreate = {
      trip_id: tripId,
      name: merchandiseForm.name,
      description: merchandiseForm.description || null,
      price: Number.parseFloat(merchandiseForm.price),
      quantity_available: Number.parseInt(merchandiseForm.quantity_available),
    }

    if (editingMerchandiseId) {
      updateMerchandiseMutation.mutate({ id: editingMerchandiseId, data })
    } else {
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
      name: merchandise.name,
      description: merchandise.description || "",
      price: merchandise.price.toString(),
      quantity_available: merchandise.quantity_available.toString(),
    })
  }

  const cancelEdit = () => {
    setEditingPricingId(null)
    setEditingMerchandiseId(null)
    setIsAddingPricing(false)
    setIsAddingMerchandise(false)
    setPricingForm({ ticket_type: "adult", price: "" })
    setMerchandiseForm({
      name: "",
      description: "",
      price: "",
      quantity_available: "",
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
                  <select
                    value={pricingForm.ticket_type}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        ticket_type: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid",
                      borderColor: "inherit",
                    }}
                  >
                    {TICKET_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
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
                  {TICKET_TYPES.find((t) => t.value === pricing.ticket_type)
                    ?.label || pricing.ticket_type}
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

        {/* Add/Edit Merchandise Form */}
        {(isAddingMerchandise || editingMerchandiseId) && (
          <Box p={4} borderWidth="1px" borderRadius="md" mb={4}>
            <VStack gap={3}>
              <HStack width="100%">
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Name
                  </Text>
                  <Input
                    value={merchandiseForm.name}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="Item name"
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
                    value={merchandiseForm.price}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        price: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </Box>
              </HStack>
              <HStack width="100%">
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Description
                  </Text>
                  <Input
                    value={merchandiseForm.description}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Item description (optional)"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1}>
                    Quantity Available
                  </Text>
                  <Input
                    type="number"
                    min="0"
                    value={merchandiseForm.quantity_available}
                    onChange={(e) =>
                      setMerchandiseForm({
                        ...merchandiseForm,
                        quantity_available: e.target.value,
                      })
                    }
                    placeholder="0"
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
                    !merchandiseForm.name ||
                    !merchandiseForm.price ||
                    !merchandiseForm.quantity_available ||
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
