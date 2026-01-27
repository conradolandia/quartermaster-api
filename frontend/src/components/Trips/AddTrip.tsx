import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  IconButton,
  Input,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FiPlus, FiTrash2 } from "react-icons/fi"

import {
  BoatsService,
  TripBoatsService,
  TripMerchandiseService,
  TripPricingService,
  TripsService,
} from "@/client"
import { MissionDropdown } from "@/components/Common/MissionDropdown"
import { NativeSelect } from "@/components/ui/native-select"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

// Props interface
interface AddTripProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Interface for boat selection
interface SelectedBoat {
  boat_id: string
  max_capacity?: number | null
  name?: string
  capacity?: number
}

// Interface for pricing selection
interface SelectedPricing {
  ticket_type: string
  price: number
}

// Interface for merchandise selection
interface SelectedMerchandise {
  name: string
  description?: string
  price: number
  quantity_available: number
}


const AddTrip = ({ isOpen, onClose, onSuccess }: AddTripProps) => {
  const [missionId, setMissionId] = useState("")
  const [type, setType] = useState("launch_viewing")
  const [active, setActive] = useState(true)
  const [checkInTime, setCheckInTime] = useState("")
  const [boardingTime, setBoardingTime] = useState("")
  const [departureTime, setDepartureTime] = useState("")
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  // Boat management
  const [boatsData, setBoatsData] = useState<any[]>([])
  const [selectedBoats, setSelectedBoats] = useState<SelectedBoat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isAddingBoat, setIsAddingBoat] = useState(false)

  // Pricing management
  const [selectedPricing, setSelectedPricing] = useState<SelectedPricing[]>([])
  const [pricingForm, setPricingForm] = useState({
    ticket_type: "",
    price: "",
  })
  const [isAddingPricing, setIsAddingPricing] = useState(false)

  // Merchandise management
  const [selectedMerchandise, setSelectedMerchandise] = useState<
    SelectedMerchandise[]
  >([])
  const [merchandiseForm, setMerchandiseForm] = useState({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
  })
  const [isAddingMerchandise, setIsAddingMerchandise] = useState(false)

  // Fetch all boats
  const { data: allBoats } = useQuery({
    queryKey: ["boats-for-add-trip"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  // Update boats data when fetched
  useEffect(() => {
    if (allBoats?.data) {
      setBoatsData(allBoats.data)
    }
  }, [allBoats])

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedBoats([])
      setSelectedBoatId("")
      setMaxCapacity(undefined)
      setIsAddingBoat(false)
      setSelectedPricing([])
      setPricingForm({ ticket_type: "", price: "" })
      setIsAddingPricing(false)
      setSelectedMerchandise([])
      setMerchandiseForm({
        name: "",
        description: "",
        price: "",
        quantity_available: "",
      })
      setIsAddingMerchandise(false)
    }
  }, [isOpen])

  // Handle adding a boat to the selection
  const handleAddBoat = () => {
    if (!selectedBoatId) return

    // Check if this boat is already in the selection
    const exists = selectedBoats.some((boat) => boat.boat_id === selectedBoatId)
    if (exists) {
      showSuccessToast("This boat is already added to the selection")
      return
    }

    // Find the boat details
    const boatDetails = boatsData.find((boat) => boat.id === selectedBoatId)

    // Add to selected boats
    setSelectedBoats([
      ...selectedBoats,
      {
        boat_id: selectedBoatId,
        max_capacity: maxCapacity || null,
        name: boatDetails?.name,
        capacity: boatDetails?.capacity,
      },
    ])

    // Reset form
    setSelectedBoatId("")
    setMaxCapacity(undefined)
    setIsAddingBoat(false)
  }

  // Handle removing a boat from the selection
  const handleRemoveBoat = (boatId: string) => {
    setSelectedBoats(selectedBoats.filter((boat) => boat.boat_id !== boatId))
  }

  // Handle adding pricing
  const handleAddPricing = () => {
    if (!pricingForm.ticket_type.trim() || !pricingForm.price) return

    // Check if this ticket type is already added
    const exists = selectedPricing.some(
      (p) => p.ticket_type === pricingForm.ticket_type,
    )
    if (exists) {
      showSuccessToast("This ticket type is already added")
      return
    }

    setSelectedPricing([
      ...selectedPricing,
      {
        ticket_type: pricingForm.ticket_type,
        price: Number.parseFloat(pricingForm.price),
      },
    ])

    setPricingForm({ ticket_type: "", price: "" })
    setIsAddingPricing(false)
  }

  // Handle removing pricing
  const handleRemovePricing = (ticketType: string) => {
    setSelectedPricing(
      selectedPricing.filter((p) => p.ticket_type !== ticketType),
    )
  }

  // Handle adding merchandise
  const handleAddMerchandise = () => {
    if (
      !merchandiseForm.name ||
      !merchandiseForm.price ||
      !merchandiseForm.quantity_available
    )
      return

    setSelectedMerchandise([
      ...selectedMerchandise,
      {
        name: merchandiseForm.name,
        description: merchandiseForm.description || undefined,
        price: Number.parseFloat(merchandiseForm.price),
        quantity_available: Number.parseInt(merchandiseForm.quantity_available),
      },
    ])

    setMerchandiseForm({
      name: "",
      description: "",
      price: "",
      quantity_available: "",
    })
    setIsAddingMerchandise(false)
  }

  // Handle removing merchandise
  const handleRemoveMerchandise = (name: string) => {
    setSelectedMerchandise(selectedMerchandise.filter((m) => m.name !== name))
  }

  // Use mutation for creating trip
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the trip
      const tripResponse = await TripsService.createTrip({
        requestBody: data,
      })

      const tripId = tripResponse.id

      // Create boat associations
      if (selectedBoats.length > 0) {
        const tripBoatPromises = selectedBoats.map((boat) =>
          TripBoatsService.createTripBoat({
            requestBody: {
              trip_id: tripId,
              boat_id: boat.boat_id,
              max_capacity: boat.max_capacity,
            },
          }),
        )
        await Promise.all(tripBoatPromises)
      }

      // Create pricing
      if (selectedPricing.length > 0) {
        const pricingPromises = selectedPricing.map((pricing) =>
          TripPricingService.createTripPricing({
            requestBody: {
              trip_id: tripId,
              ticket_type: pricing.ticket_type,
              price: pricing.price,
            },
          }),
        )
        await Promise.all(pricingPromises)
      }

      // Create merchandise
      if (selectedMerchandise.length > 0) {
        const merchandisePromises = selectedMerchandise.map((merchandise) =>
          TripMerchandiseService.createTripMerchandise({
            requestBody: {
              trip_id: tripId,
              name: merchandise.name,
              description: merchandise.description,
              price: merchandise.price,
              quantity_available: merchandise.quantity_available,
            },
          }),
        )
        await Promise.all(merchandisePromises)
      }

      return tripResponse
    },
    onSuccess: () => {
      showSuccessToast("Trip was successfully added")
      setMissionId("")
      setType("launch_viewing")
      setActive(true)
      setCheckInTime("")
      setBoardingTime("")
      setDepartureTime("")
      setSelectedBoats([])
      setSelectedPricing([])
      setSelectedMerchandise([])
      queryClient.invalidateQueries({ queryKey: ["trips"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-pricing"] })
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const handleSubmit = async () => {
    if (!missionId || !checkInTime || !boardingTime || !departureTime) return
    // Require at least one boat
    if (selectedBoats.length === 0) {
      showSuccessToast("Please add at least one boat to the trip")
      return
    }
    // Require at least one ticket price
    if (selectedPricing.length === 0) {
      showSuccessToast(
        "Please configure at least one ticket price (e.g., Adult)",
      )
      return
    }

    mutation.mutate({
      mission_id: missionId,
      type: type,
      active: active,
      check_in_time: new Date(checkInTime).toISOString(),
      boarding_time: new Date(boardingTime).toISOString(),
      departure_time: new Date(departureTime).toISOString(),
    })
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "lg" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent ref={contentRef}>
          <DialogHeader>
            <DialogTitle>Add Trip</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Tabs.Root defaultValue="basic-info" variant="subtle">
              <Tabs.List>
                <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
                <Tabs.Trigger value="boats">Boats</Tabs.Trigger>
                <Tabs.Trigger value="pricing">
                  Pricing & Merchandise
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="basic-info">
                <VStack gap={4}>
                  <Field label="Mission" required>
                    <MissionDropdown
                      id="mission_id"
                      value={missionId}
                      onChange={setMissionId}
                      isDisabled={mutation.isPending}
                      portalRef={contentRef}
                    />
                  </Field>
                  <Field label="Type" required>
                    <NativeSelect
                      id="type"
                      value={type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setType(e.target.value)
                      }
                    >
                      <option value="launch_viewing">Launch Viewing</option>
                      <option value="pre_launch">Pre-Launch</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Check-in Time" required>
                    <Input
                      id="check_in_time"
                      type="datetime-local"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      placeholder="Check-in time"
                    />
                  </Field>
                  <Field label="Boarding Time" required>
                    <Input
                      id="boarding_time"
                      type="datetime-local"
                      value={boardingTime}
                      onChange={(e) => setBoardingTime(e.target.value)}
                      placeholder="Boarding time"
                    />
                  </Field>
                  <Field label="Departure Time" required>
                    <Input
                      id="departure_time"
                      type="datetime-local"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      placeholder="Departure time"
                    />
                  </Field>
                  <Field>
                    <Flex
                      alignItems="center"
                      justifyContent="space-between"
                      width="100%"
                    >
                      <Text>Active</Text>
                      <Switch
                        checked={active}
                        onCheckedChange={(details) =>
                          setActive(details.checked)
                        }
                        inputProps={{ id: "active" }}
                      />
                    </Flex>
                  </Field>
                </VStack>
              </Tabs.Content>

              {/* Boats Tab */}
              <Tabs.Content value="boats">
                <Box width="100%">
                  <Text fontWeight="bold" mb={2}>
                    Associated Boats
                  </Text>

                  {/* List of selected boats */}
                  {selectedBoats.length > 0 ? (
                    <VStack align="stretch" mb={4} gap={2}>
                      {selectedBoats.map((boat) => (
                        <Flex
                          key={boat.boat_id}
                          justify="space-between"
                          align="center"
                          p={2}
                          borderWidth="1px"
                          borderRadius="md"
                        >
                          <Text>
                            {boat.name || "Unknown"} (Capacity:{" "}
                            {boat.max_capacity || boat.capacity || "Unknown"})
                          </Text>
                          <IconButton
                            aria-label="Remove boat"
                            children={<FiTrash2 />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleRemoveBoat(boat.boat_id)}
                          />
                        </Flex>
                      ))}
                    </VStack>
                  ) : (
                    <Text mb={4}>No boats selected yet.</Text>
                  )}

                  {/* Add boat form */}
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
                        <Button
                          size="sm"
                          onClick={() => setIsAddingBoat(false)}
                        >
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
                    <Button
                      onClick={() => setIsAddingBoat(true)}
                      size="sm"
                      mb={4}
                    >
                      <FiPlus style={{ marginRight: "4px" }} />
                      Add Boat
                    </Button>
                  )}
                </Box>
              </Tabs.Content>

              {/* Pricing & Merchandise Tab */}
              <Tabs.Content value="pricing">
                <VStack align="stretch" gap={6}>
                  {/* Trip Pricing Section */}
                  <Box>
                    <HStack justify="space-between" mb={4}>
                      <Text fontWeight="bold" fontSize="lg">
                        Ticket Pricing
                      </Text>
                      {!isAddingPricing && (
                        <Button
                          size="sm"
                          onClick={() => setIsAddingPricing(true)}
                        >
                          <FiPlus style={{ marginRight: "4px" }} />
                          Add Pricing
                        </Button>
                      )}
                    </HStack>

                    {/* Add Pricing Form */}
                    {isAddingPricing && (
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
                                  setPricingForm({
                                    ...pricingForm,
                                    price: e.target.value,
                                  })
                                }
                                placeholder="0.00"
                              />
                            </Box>
                          </HStack>
                          <HStack width="100%" justify="flex-end">
                            <Button
                              size="sm"
                              onClick={() => setIsAddingPricing(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={handleAddPricing}
                              disabled={!pricingForm.ticket_type.trim() || !pricingForm.price}
                            >
                              Add Pricing
                            </Button>
                          </HStack>
                        </VStack>
                      </Box>
                    )}

                    {/* Pricing List */}
                    <VStack align="stretch" gap={2}>
                      {selectedPricing.map((pricing) => (
                        <HStack
                          key={pricing.ticket_type}
                          justify="space-between"
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                        >
                          <HStack>
                            <Text fontWeight="medium">
                              {pricing.ticket_type}
                            </Text>
                            <Text>${pricing.price.toFixed(2)}</Text>
                          </HStack>
                          <IconButton
                            aria-label="Remove pricing"
                            children={<FiTrash2 />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() =>
                              handleRemovePricing(pricing.ticket_type)
                            }
                          />
                        </HStack>
                      ))}
                      {selectedPricing.length === 0 && (
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
                      {!isAddingMerchandise && (
                        <Button
                          size="sm"
                          onClick={() => setIsAddingMerchandise(true)}
                        >
                          <FiPlus style={{ marginRight: "4px" }} />
                          Add Merchandise
                        </Button>
                      )}
                    </HStack>

                    {/* Add Merchandise Form */}
                    {isAddingMerchandise && (
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
                            <Button
                              size="sm"
                              onClick={() => setIsAddingMerchandise(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={handleAddMerchandise}
                              disabled={
                                !merchandiseForm.name ||
                                !merchandiseForm.price ||
                                !merchandiseForm.quantity_available
                              }
                            >
                              Add Merchandise
                            </Button>
                          </HStack>
                        </VStack>
                      </Box>
                    )}

                    {/* Merchandise List */}
                    <VStack align="stretch" gap={2}>
                      {selectedMerchandise.map((merchandise) => (
                        <HStack
                          key={merchandise.name}
                          justify="space-between"
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                        >
                          <VStack align="start" flex={1}>
                            <Text fontWeight="medium">{merchandise.name}</Text>
                            {merchandise.description && (
                              <Text fontSize="sm" color="gray.600">
                                {merchandise.description}
                              </Text>
                            )}
                            <HStack>
                              <Text fontSize="sm">
                                ${merchandise.price.toFixed(2)}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                ({merchandise.quantity_available} available)
                              </Text>
                            </HStack>
                          </VStack>
                          <IconButton
                            aria-label="Remove merchandise"
                            children={<FiTrash2 />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() =>
                              handleRemoveMerchandise(merchandise.name)
                            }
                          />
                        </HStack>
                      ))}
                      {selectedMerchandise.length === 0 && (
                        <Text color="gray.500" textAlign="center" py={4}>
                          No merchandise configured for this trip
                        </Text>
                      )}
                    </VStack>
                  </Box>
                </VStack>
              </Tabs.Content>
            </Tabs.Root>
          </DialogBody>
          <DialogFooter gap={2}>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button
                  variant="subtle"
                  colorPalette="gray"
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
              </DialogActionTrigger>
              <Button
                variant="solid"
                onClick={handleSubmit}
                loading={mutation.isPending}
                disabled={
                  !missionId ||
                  !checkInTime ||
                  !boardingTime ||
                  !departureTime ||
                  selectedBoats.length === 0 ||
                  mutation.isPending
                }
              >
                Add
              </Button>
            </ButtonGroup>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
    </DialogRoot>
  )
}

export default AddTrip
