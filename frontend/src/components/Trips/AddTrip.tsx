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
  LaunchesService,
  MerchandiseService,
  MissionsService,
  TripBoatPricingService,
  TripBoatsService,
  TripMerchandiseService,
  TripsService,
} from "@/client"
import { MissionDropdown } from "@/components/Common/MissionDropdown"
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
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatCents,
  formatInLocationTimezone,
  formatLocationTimezoneDisplay,
  handleError,
  parseApiDate,
  parseLocationTimeToUtc,
} from "@/utils"

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

// Catalog merchandise selection for new trip (merchandise_id + optional overrides)
interface SelectedMerchandise {
  merchandise_id: string
  name: string
  price_override?: number | null
  quantity_available_override?: number | null
}

const bookingModeOptions = [
  { label: "Private (Admin Only)", value: "private" },
  { label: "Early Bird (Access Code Required)", value: "early_bird" },
  { label: "Public (Open to All)", value: "public" },
]

const AddTrip = ({ isOpen, onClose, onSuccess }: AddTripProps) => {
  const [missionId, setMissionId] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState("launch_viewing")
  const [active, setActive] = useState(true)
  const [bookingMode, setBookingMode] = useState("private")
  const [departureTime, setDepartureTime] = useState("")
  const [salesOpenAt, setSalesOpenAt] = useState("")
  const [boardingMinutesBeforeDeparture, setBoardingMinutesBeforeDeparture] =
    useState(30)
  const [checkinMinutesBeforeBoarding, setCheckinMinutesBeforeBoarding] =
    useState(30)
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
    merchandise_id: "",
    price_override: "",
    quantity_available_override: "",
  })
  const [isAddingMerchandise, setIsAddingMerchandise] = useState(false)

  // Fetch all boats
  const { data: allBoats } = useQuery({
    queryKey: ["boats-for-add-trip"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  const { data: missionData } = useQuery({
    queryKey: ["mission-for-add-trip", missionId],
    queryFn: () => MissionsService.readMission({ missionId }),
    enabled: !!missionId && isOpen,
  })
  const timezone = missionData?.timezone ?? null

  const { data: launchData } = useQuery({
    queryKey: ["launch-for-add-trip", missionData?.launch_id],
    queryFn: () =>
      LaunchesService.readLaunch({ launchId: missionData!.launch_id }),
    enabled: !!missionData?.launch_id && isOpen,
  })

  const { data: catalogMerchandise } = useQuery({
    queryKey: ["merchandise-catalog"],
    queryFn: () =>
      MerchandiseService.readMerchandiseList({ limit: 500, skip: 0 }),
    enabled: isOpen,
  })

  // Update boats data when fetched
  useEffect(() => {
    if (allBoats?.data) {
      setBoatsData(allBoats.data)
    }
  }, [allBoats])

  // Default offsets by type: launch_viewing 30/30, pre_launch 15/15
  useEffect(() => {
    if (type === "launch_viewing") {
      setBoardingMinutesBeforeDeparture(30)
      setCheckinMinutesBeforeBoarding(30)
    } else {
      setBoardingMinutesBeforeDeparture(15)
      setCheckinMinutesBeforeBoarding(15)
    }
  }, [type])

  // Pre-fill departure from launch (launch - 2h) when type is launch_viewing and mission/launch loaded (only when empty)
  useEffect(() => {
    if (
      !isOpen ||
      type !== "launch_viewing" ||
      !launchData?.launch_timestamp ||
      !timezone ||
      departureTime.trim() !== ""
    )
      return
    const launchDate = parseApiDate(launchData.launch_timestamp)
    const departureDate = new Date(
      launchDate.getTime() - 2 * 60 * 60 * 1000,
    )
    setDepartureTime(formatInLocationTimezone(departureDate, timezone))
  }, [isOpen, type, launchData?.launch_timestamp, timezone, departureTime])

  // When Add Merchandise form opens and catalog has data, select first item so button is enabled (native select shows first option but state stays "" otherwise)
  useEffect(() => {
    if (
      isAddingMerchandise &&
      catalogMerchandise?.data?.length &&
      !merchandiseForm.merchandise_id
    ) {
      const firstId = catalogMerchandise.data[0].id
      setMerchandiseForm((prev) => ({ ...prev, merchandise_id: firstId }))
    }
  }, [isAddingMerchandise, catalogMerchandise?.data, merchandiseForm.merchandise_id])

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setMissionId("")
      setName("")
      setType("launch_viewing")
      setActive(true)
      setBookingMode("private")
      setDepartureTime("")
      setSalesOpenAt("")
      setBoardingMinutesBeforeDeparture(30)
      setCheckinMinutesBeforeBoarding(30)
      setSelectedBoats([])
      setSelectedBoatId("")
      setMaxCapacity(undefined)
      setIsAddingBoat(false)
      setSelectedPricing([])
      setPricingForm({ ticket_type: "", price: "" })
      setIsAddingPricing(false)
      setSelectedMerchandise([])
      setMerchandiseForm({
        merchandise_id: "",
        price_override: "",
        quantity_available_override: "",
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
        price: Math.round(Number.parseFloat(pricingForm.price) * 100),
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

  // Handle adding merchandise (from catalog)
  const handleAddMerchandise = () => {
    if (!merchandiseForm.merchandise_id) return
    const catalogItem = catalogMerchandise?.data.find(
      (m) => m.id === merchandiseForm.merchandise_id,
    )
    if (!catalogItem) return

    const alreadyAdded = selectedMerchandise.some(
      (m) => m.merchandise_id === merchandiseForm.merchandise_id,
    )
    if (alreadyAdded) {
      showSuccessToast("This item is already added")
      return
    }

    setSelectedMerchandise([
      ...selectedMerchandise,
      {
        merchandise_id: catalogItem.id,
        name: catalogItem.name,
        price_override: merchandiseForm.price_override
          ? Math.round(Number.parseFloat(merchandiseForm.price_override) * 100)
          : null,
        quantity_available_override: merchandiseForm.quantity_available_override
          ? Number.parseInt(merchandiseForm.quantity_available_override, 10)
          : null,
      },
    ])

    setMerchandiseForm({
      merchandise_id: "",
      price_override: "",
      quantity_available_override: "",
    })
    setIsAddingMerchandise(false)
  }

  // Handle removing merchandise
  const handleRemoveMerchandise = (merchandiseId: string) => {
    setSelectedMerchandise(
      selectedMerchandise.filter((m) => m.merchandise_id !== merchandiseId),
    )
  }

  // Use mutation for creating trip
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the trip
      const tripResponse = await TripsService.createTrip({
        requestBody: data,
      })

      const tripId = tripResponse.id

      // Create boat associations, then trip-boat pricing for each boat
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
        const createdTripBoats = await Promise.all(tripBoatPromises)
        if (selectedPricing.length > 0) {
          const pricingPromises: Promise<unknown>[] = []
          for (const tb of createdTripBoats) {
            for (const pricing of selectedPricing) {
              pricingPromises.push(
                TripBoatPricingService.createTripBoatPricing({
                  requestBody: {
                    trip_boat_id: tb.id,
                    ticket_type: pricing.ticket_type,
                    price: pricing.price,
                  },
                }),
              )
            }
          }
          await Promise.all(pricingPromises)
        }
      }

      // Create merchandise (link catalog items to trip with optional overrides)
      if (selectedMerchandise.length > 0) {
        const merchandisePromises = selectedMerchandise.map((item) =>
          TripMerchandiseService.createTripMerchandise({
            requestBody: {
              trip_id: tripId,
              merchandise_id: item.merchandise_id,
              price_override: item.price_override ?? null,
              quantity_available_override:
                item.quantity_available_override ?? null,
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
      setBookingMode("private")
      setDepartureTime("")
      setSalesOpenAt("")
      setBoardingMinutesBeforeDeparture(30)
      setCheckinMinutesBeforeBoarding(30)
      setSelectedBoats([])
      setSelectedPricing([])
      setSelectedMerchandise([])
      queryClient.invalidateQueries({ queryKey: ["trips"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boat-pricing"] })
      queryClient.invalidateQueries({ queryKey: ["trip-merchandise"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const handleSubmit = async () => {
    if (!missionId || !departureTime) return
    if (
      boardingMinutesBeforeDeparture < 0 ||
      checkinMinutesBeforeBoarding < 0
    )
      return
    if (selectedBoats.length === 0) {
      showSuccessToast("Please add at least one boat to the trip")
      return
    }
    if (selectedPricing.length === 0) {
      showSuccessToast(
        "Please configure at least one ticket price (e.g., Adult)",
      )
      return
    }

    const tz = timezone ?? "UTC"
    mutation.mutate({
      mission_id: missionId,
      name: name || null,
      type: type,
      active: active,
      booking_mode: bookingMode,
      sales_open_at: salesOpenAt
        ? parseLocationTimeToUtc(salesOpenAt, tz)
        : null,
      departure_time: parseLocationTimeToUtc(departureTime, tz),
      boarding_minutes_before_departure: boardingMinutesBeforeDeparture,
      checkin_minutes_before_boarding: checkinMinutesBeforeBoarding,
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
              <Tabs.Trigger value="pricing">Pricing & Merchandise</Tabs.Trigger>
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
                <Field
                  label="Name"
                  helperText="Optional custom label for this trip"
                >
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Trip name (optional)"
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
                <Field
                  label="Booking Mode"
                  helperText="Controls who can book this trip"
                >
                  <NativeSelect
                    id="booking_mode"
                    value={bookingMode}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setBookingMode(e.target.value)
                    }
                  >
                    {bookingModeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  label={
                    timezone
                      ? `Sales Open (${formatLocationTimezoneDisplay(
                          timezone,
                        )})`
                      : "Sales Open"
                  }
                  helperText="Trip is not bookable until this time. Leave empty for no restriction."
                >
                  <Input
                    id="sales_open_at"
                    type="datetime-local"
                    value={salesOpenAt}
                    onChange={(e) => setSalesOpenAt(e.target.value)}
                    placeholder={
                      timezone
                        ? `Enter time in ${formatLocationTimezoneDisplay(
                            timezone,
                          )}`
                        : "Select mission for timezone"
                    }
                  />
                </Field>
                <Field
                  label={
                    timezone
                      ? `Departure Time (${formatLocationTimezoneDisplay(
                          timezone,
                        )})`
                      : "Departure Time"
                  }
                  helperText={
                    type === "launch_viewing" && launchData
                      ? "Pre-filled from launch time minus 2 hours"
                      : undefined
                  }
                  required
                >
                  <Input
                    id="departure_time"
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    placeholder={
                      timezone
                        ? `Enter time in ${formatLocationTimezoneDisplay(
                            timezone,
                          )}`
                        : "Select mission for timezone"
                    }
                  />
                </Field>
                <Field
                  label="Boarding (minutes before departure)"
                  helperText="When boarding starts relative to departure"
                >
                  <Input
                    id="boarding_minutes"
                    type="number"
                    min={0}
                    value={boardingMinutesBeforeDeparture}
                    onChange={(e) =>
                      setBoardingMinutesBeforeDeparture(
                        Math.max(0, parseInt(e.target.value, 10) || 0),
                      )
                    }
                  />
                </Field>
                <Field
                  label="Check-in (minutes before boarding)"
                  helperText="When check-in opens relative to boarding"
                >
                  <Input
                    id="checkin_minutes"
                    type="number"
                    min={0}
                    value={checkinMinutesBeforeBoarding}
                    onChange={(e) =>
                      setCheckinMinutesBeforeBoarding(
                        Math.max(0, parseInt(e.target.value, 10) || 0),
                      )
                    }
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
                      onCheckedChange={(details) => setActive(details.checked)}
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
                            disabled={
                              !pricingForm.ticket_type.trim() ||
                              !pricingForm.price
                            }
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
                          <Text fontWeight="medium">{pricing.ticket_type}</Text>
                          <Text>${formatCents(pricing.price)}</Text>
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

                  {/* Add Merchandise Form (select from catalog + optional overrides) */}
                  {isAddingMerchandise && (
                    <Box p={4} borderWidth="1px" borderRadius="md" mb={4}>
                      <VStack gap={3}>
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
                              placeholder="Select merchandise"
                            >
                              {catalogMerchandise?.data.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} — ${formatCents(m.price)} (qty{" "}
                                  {m.quantity_available})
                                </option>
                              ))}
                            </NativeSelect>
                          </Box>
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
                              value={
                                merchandiseForm.quantity_available_override
                              }
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
                            disabled={!merchandiseForm.merchandise_id}
                          >
                            Add Merchandise
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  )}

                  {/* Merchandise List */}
                  <VStack align="stretch" gap={2}>
                    {selectedMerchandise.map((item) => (
                      <HStack
                        key={item.merchandise_id}
                        justify="space-between"
                        p={3}
                        borderWidth="1px"
                        borderRadius="md"
                      >
                        <VStack align="start" flex={1}>
                          <Text fontWeight="medium">{item.name}</Text>
                          <HStack fontSize="sm" color="gray.500">
                            {item.price_override != null && (
                              <Text>
                                Price override: $
                                {formatCents(item.price_override)}
                              </Text>
                            )}
                            {item.quantity_available_override != null && (
                              <Text>
                                Qty override: {item.quantity_available_override}
                              </Text>
                            )}
                            {item.price_override == null &&
                              item.quantity_available_override == null && (
                                <Text>Catalog defaults</Text>
                              )}
                          </HStack>
                        </VStack>
                        <IconButton
                          aria-label="Remove merchandise"
                          children={<FiTrash2 />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() =>
                            handleRemoveMerchandise(item.merchandise_id)
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
