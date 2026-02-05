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
import {
  FiDollarSign,
  FiPlus,
  FiSliders,
  FiTrash2,
} from "react-icons/fi"

import {
  BoatPricingService,
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

// Interface for boat selection (matches EditTrip trip-boat shape for UI)
interface SelectedBoat {
  boat_id: string
  max_capacity?: number | null
  name?: string
  capacity?: number
  pricing: Array<{ ticket_type: string; price: number; capacity?: number }>
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
  const [unlisted, setUnlisted] = useState(false)
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

  // Boat management (same UI model as EditTrip)
  const [boatsData, setBoatsData] = useState<any[]>([])
  const [selectedBoats, setSelectedBoats] = useState<SelectedBoat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isAddingBoat, setIsAddingBoat] = useState(false)
  const [selectedBoatForPricing, setSelectedBoatForPricing] = useState<{
    boatId: string
    boatName: string
  } | null>(null)
  const [editingCapacityBoatId, setEditingCapacityBoatId] = useState<
    string | null
  >(null)
  const [capacityInputValue, setCapacityInputValue] = useState("")
  const [tripBoatPricingForm, setTripBoatPricingForm] = useState({
    ticket_type: "",
    price: "",
    capacity: "",
  })
  const [isAddingTripBoatPricing, setIsAddingTripBoatPricing] = useState(false)

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

  // Boat defaults (BoatPricing) for the boat whose pricing panel is open
  const { data: boatDefaultsList = [] } = useQuery({
    queryKey: ["boat-pricing", selectedBoatForPricing?.boatId],
    queryFn: () =>
      BoatPricingService.listBoatPricing({
        boatId: selectedBoatForPricing!.boatId,
      }),
    enabled: isOpen && !!selectedBoatForPricing?.boatId,
  })

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
      setSelectedBoatForPricing(null)
      setEditingCapacityBoatId(null)
      setTripBoatPricingForm({ ticket_type: "", price: "", capacity: "" })
      setIsAddingTripBoatPricing(false)
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

    const exists = selectedBoats.some((boat) => boat.boat_id === selectedBoatId)
    if (exists) {
      showSuccessToast("This boat is already added to the selection")
      return
    }
    const boatDetails = boatsData.find((boat) => boat.id === selectedBoatId)
    setSelectedBoats([
      ...selectedBoats,
      {
        boat_id: selectedBoatId,
        max_capacity: maxCapacity ?? null,
        name: boatDetails?.name,
        capacity: boatDetails?.capacity,
        pricing: [],
      },
    ])
    setSelectedBoatId("")
    setMaxCapacity(undefined)
    setIsAddingBoat(false)
  }

  const handleRemoveBoat = (boatId: string) => {
    if (selectedBoatForPricing?.boatId === boatId) {
      setSelectedBoatForPricing(null)
      setIsAddingTripBoatPricing(false)
    }
    if (editingCapacityBoatId === boatId) {
      setEditingCapacityBoatId(null)
      setCapacityInputValue("")
    }
    setSelectedBoats(selectedBoats.filter((boat) => boat.boat_id !== boatId))
  }

  const handleSaveCapacity = (boatId: string) => {
    const trimmed = capacityInputValue.trim()
    if (trimmed === "") return
    const num = Number.parseInt(trimmed, 10)
    if (Number.isNaN(num) || num < 1) return
    setSelectedBoats((prev) =>
      prev.map((b) =>
        b.boat_id === boatId ? { ...b, max_capacity: num } : b,
      ),
    )
    setEditingCapacityBoatId(null)
    setCapacityInputValue("")
  }

  const handleAddBoatPricing = () => {
    if (!selectedBoatForPricing) return
    const priceDollars = Number.parseFloat(tripBoatPricingForm.price)
    const cap = tripBoatPricingForm.capacity.trim()
      ? Number.parseInt(tripBoatPricingForm.capacity, 10)
      : undefined
    if (
      !tripBoatPricingForm.ticket_type.trim() ||
      Number.isNaN(priceDollars) ||
      priceDollars < 0
    )
      return
    if (cap !== undefined && (Number.isNaN(cap) || cap < 0)) return
    setSelectedBoats((prev) =>
      prev.map((b) =>
        b.boat_id === selectedBoatForPricing.boatId
          ? {
              ...b,
              pricing: [
                ...b.pricing,
                {
                  ticket_type: tripBoatPricingForm.ticket_type.trim(),
                  price: Math.round(priceDollars * 100),
                  capacity: cap,
                },
              ],
            }
          : b,
      ),
    )
    setTripBoatPricingForm({ ticket_type: "", price: "", capacity: "" })
    setIsAddingTripBoatPricing(false)
  }

  const handleRemoveBoatPricing = (boatId: string, ticketType: string) => {
    setSelectedBoats((prev) =>
      prev.map((b) =>
        b.boat_id === boatId
          ? {
              ...b,
              pricing: b.pricing.filter((p) => p.ticket_type !== ticketType),
            }
          : b,
      ),
    )
  }

  const boatsMap = new Map<string, any>()
  boatsData.forEach((boat) => boatsMap.set(boat.id, boat))

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

      // Create boat associations, then per-boat trip-boat pricing
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
        const pricingPromises: Promise<unknown>[] = []
        for (let i = 0; i < createdTripBoats.length; i++) {
          const tb = createdTripBoats[i]
          const boat = selectedBoats[i]
          for (const p of boat.pricing ?? []) {
            pricingPromises.push(
              TripBoatPricingService.createTripBoatPricing({
                requestBody: {
                  trip_boat_id: tb.id,
                  ticket_type: p.ticket_type,
                  price: p.price,
                  capacity: p.capacity ?? undefined,
                },
              }),
            )
          }
        }
        if (pricingPromises.length > 0) {
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
      setSelectedBoatForPricing(null)
      setEditingCapacityBoatId(null)
      setTripBoatPricingForm({ ticket_type: "", price: "", capacity: "" })
      setIsAddingTripBoatPricing(false)
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

    const tz = timezone ?? "UTC"
    mutation.mutate({
      mission_id: missionId,
      name: name || null,
      type: type,
      active: active,
      unlisted: unlisted,
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
              <Tabs.Trigger value="pricing">Merchandise</Tabs.Trigger>
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
                <Field
                  helperText="Only visible via direct link; excluded from public listing."
                >
                  <Flex
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Text>Unlisted</Text>
                    <Switch
                      checked={unlisted}
                      onCheckedChange={(details) => setUnlisted(details.checked)}
                      inputProps={{ id: "unlisted" }}
                    />
                  </Flex>
                </Field>
              </VStack>
            </Tabs.Content>

            {/* Boats Tab - same interface as Edit Trip */}
            <Tabs.Content value="boats">
              <Box width="100%">
                <Text fontWeight="bold" mb={2}>
                  Associated Boats
                </Text>

                {selectedBoats.length > 0 ? (
                  <VStack align="stretch" mb={4} gap={2}>
                    {selectedBoats.map((boat) => {
                      const maxCap =
                        boat.max_capacity ?? boat.capacity ?? 0
                      const used = 0
                      const remaining = maxCap
                      const isPricingOpen =
                        selectedBoatForPricing?.boatId === boat.boat_id
                      const boatPricing = boat.pricing ?? []
                      return (
                        <Box key={boat.boat_id}>
                          <Flex
                            justify="space-between"
                            align="center"
                            p={2}
                            borderWidth="1px"
                            borderRadius="md"
                          >
                            <Box>
                              <Text color="gray.100" fontWeight="medium">
                                {boat.name || "Unknown"}
                              </Text>
                              <Text
                                fontSize="xs"
                                color="gray.300"
                                mt={0.5}
                                lineHeight="1.2"
                              >
                                {used} of {maxCap} seats taken ({remaining}{" "}
                                remaining)
                              </Text>
                              {boatPricing.length > 0 && (
                                <VStack align="start" gap={0}>
                                  {boatPricing.map((p) => (
                                    <Text
                                      key={p.ticket_type}
                                      fontSize="xs"
                                      color="gray.500"
                                      lineHeight="1.2"
                                    >
                                      {p.ticket_type}: $
                                      {formatCents(p.price)}
                                      {p.capacity != null
                                        ? ` (${p.capacity} seats)`
                                        : ""}
                                    </Text>
                                  ))}
                                </VStack>
                              )}
                            </Box>
                            <Flex gap={1} align="center">
                              <IconButton
                                aria-label="Pricing overrides"
                                title="Pricing"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setSelectedBoatForPricing(
                                    isPricingOpen
                                      ? null
                                      : {
                                          boatId: boat.boat_id,
                                          boatName: boat.name || "Unknown",
                                        },
                                  )
                                }
                              >
                                <FiDollarSign />
                              </IconButton>
                              <IconButton
                                aria-label="Capacity override"
                                title="Capacity"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const isCapacityOpen =
                                    editingCapacityBoatId === boat.boat_id
                                  if (isCapacityOpen) {
                                    setEditingCapacityBoatId(null)
                                    setCapacityInputValue("")
                                  } else {
                                    setEditingCapacityBoatId(boat.boat_id)
                                    setCapacityInputValue(
                                      boat.max_capacity != null
                                        ? String(boat.max_capacity)
                                        : boat.capacity != null
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
                                onClick={() => handleRemoveBoat(boat.boat_id)}
                              />
                            </Flex>
                          </Flex>
                          {editingCapacityBoatId === boat.boat_id && (
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
                                Capacity override for {boat.name || "Unknown"}
                              </Text>
                              <Text fontSize="sm" color="gray.500" mb={2}>
                                Boat default: {boat.capacity ?? "—"} seats.
                                Set a lower limit for this trip or leave
                                default.
                              </Text>
                              <HStack
                                gap={2}
                                align="center"
                                flexWrap="wrap"
                              >
                                <Input
                                  type="number"
                                  min={1}
                                  size="sm"
                                  width="24"
                                  placeholder={String(boat.capacity ?? "")}
                                  value={capacityInputValue}
                                  onChange={(e) =>
                                    setCapacityInputValue(e.target.value)
                                  }
                                />
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedBoats((prev) =>
                                      prev.map((b) =>
                                        b.boat_id === boat.boat_id
                                          ? { ...b, max_capacity: null }
                                          : b,
                                      ),
                                    )
                                    setEditingCapacityBoatId(null)
                                    setCapacityInputValue("")
                                  }}
                                >
                                  Use default
                                </Button>
                                <Button
                                  size="xs"
                                  onClick={() =>
                                    handleSaveCapacity(boat.boat_id)
                                  }
                                  disabled={
                                    capacityInputValue.trim() === "" ||
                                    (() => {
                                      const n = Number.parseInt(
                                        capacityInputValue.trim(),
                                        10,
                                      )
                                      return (
                                        Number.isNaN(n) || n < 1
                                      )
                                    })()
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingCapacityBoatId(null)
                                    setCapacityInputValue("")
                                  }}
                                >
                                  Cancel
                                </Button>
                              </HStack>
                            </Box>
                          )}
                          {isPricingOpen && (
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
                                  Pricing overrides for{" "}
                                  {boat.name || "Unknown"}
                                </Text>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedBoatForPricing(null)
                                    setIsAddingTripBoatPricing(false)
                                  }}
                                >
                                  Close
                                </Button>
                              </HStack>
                              <Text fontSize="xs" color="gray.400" mb={2}>
                                Boat defaults apply unless you add an override
                                for this trip. Overrides replace the default
                                price for that ticket type.
                              </Text>
                              <Box mb={3}>
                                <Text
                                  fontSize="sm"
                                  fontWeight="bold"
                                  mb={2}
                                  color="gray.500"
                                >
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
                                        _dark={{
                                          borderColor: "gray.600",
                                          bg: "gray.800",
                                        }}
                                      >
                                        <Text fontSize="sm">
                                          {bp.ticket_type}
                                        </Text>
                                        <Text
                                          fontSize="sm"
                                          color="gray.500"
                                        >
                                          ${formatCents(bp.price)} (default)
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
                              <Text
                                fontSize="sm"
                                fontWeight="bold"
                                mb={2}
                                color="gray.700"
                                _dark={{ color: "gray.300" }}
                              >
                                Overrides for this trip
                              </Text>
                              <VStack align="stretch" gap={2}>
                                {boatPricing.map((p) => (
                                  <HStack
                                    key={p.ticket_type}
                                    justify="space-between"
                                    p={2}
                                    borderWidth="1px"
                                    borderRadius="md"
                                    borderColor="gray.600"
                                  >
                                    <HStack flex={1} gap={2}>
                                      <Text fontWeight="medium">
                                        {p.ticket_type}
                                      </Text>
                                      <Text
                                        fontSize="sm"
                                        color="gray.500"
                                      >
                                        ${formatCents(p.price)}
                                        {p.capacity != null
                                          ? `, ${p.capacity} seats`
                                          : ""}
                                      </Text>
                                    </HStack>
                                    <IconButton
                                      aria-label="Remove override"
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="red"
                                      onClick={() =>
                                        handleRemoveBoatPricing(
                                          boat.boat_id,
                                          p.ticket_type,
                                        )
                                      }
                                    >
                                      <FiTrash2 />
                                    </IconButton>
                                  </HStack>
                                ))}
                                {boatPricing.length === 0 &&
                                  !isAddingTripBoatPricing && (
                                    <Text
                                      fontSize="sm"
                                      color="gray.500"
                                      py={2}
                                    >
                                      No overrides. Boat default pricing
                                      applies.
                                    </Text>
                                  )}
                                {isAddingTripBoatPricing ? (
                                  <VStack
                                    align="stretch"
                                    gap={2}
                                    mt={3}
                                    p={2}
                                    borderWidth="1px"
                                    borderRadius="md"
                                  >
                                    <HStack width="100%" align="flex-end">
                                      <Box flex={1}>
                                        <Text fontSize="sm" mb={1}>
                                          Ticket type
                                        </Text>
                                        <NativeSelect
                                          value={(() => {
                                            const defaultsNotOverridden =
                                              boatDefaultsList.filter(
                                                (bp) =>
                                                  !boatPricing.some(
                                                    (p) =>
                                                      p.ticket_type ===
                                                      bp.ticket_type,
                                                  ),
                                              )
                                            const isDefault =
                                              defaultsNotOverridden.some(
                                                (bp) =>
                                                  bp.ticket_type ===
                                                  tripBoatPricingForm.ticket_type,
                                              )
                                            if (isDefault)
                                              return tripBoatPricingForm.ticket_type
                                            if (tripBoatPricingForm.ticket_type)
                                              return "__other__"
                                            return ""
                                          })()}
                                          onChange={(
                                            e: React.ChangeEvent<HTMLSelectElement>,
                                          ) => {
                                            const v = e.target.value
                                            setTripBoatPricingForm((prev) => ({
                                              ...prev,
                                              ticket_type:
                                                v === "__other__" ? "" : v,
                                            }))
                                          }}
                                        >
                                          <option value="">
                                            Select type
                                          </option>
                                          {boatDefaultsList
                                            .filter(
                                              (bp) =>
                                                !boatPricing.some(
                                                  (p) =>
                                                    p.ticket_type ===
                                                    bp.ticket_type,
                                                ),
                                            )
                                            .map((bp) => (
                                              <option
                                                key={bp.id}
                                                value={bp.ticket_type}
                                              >
                                                {bp.ticket_type} (default $
                                                {formatCents(bp.price)})
                                              </option>
                                            ))}
                                          <option value="__other__">
                                            Other (type below)
                                          </option>
                                        </NativeSelect>
                                        {!boatDefaultsList.some(
                                          (bp) =>
                                            bp.ticket_type ===
                                            tripBoatPricingForm.ticket_type,
                                        ) && (
                                          <Input
                                            mt={2}
                                            size="sm"
                                            value={
                                              tripBoatPricingForm.ticket_type
                                            }
                                            onChange={(e) =>
                                              setTripBoatPricingForm((prev) => ({
                                                ...prev,
                                                ticket_type: e.target.value,
                                              }))
                                            }
                                            placeholder="e.g. VIP, Premium"
                                          />
                                        )}
                                      </Box>
                                      <Box flex={1}>
                                        <Text fontSize="sm" mb={1}>
                                          Price ($)
                                        </Text>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={tripBoatPricingForm.price}
                                          onChange={(e) =>
                                            setTripBoatPricingForm({
                                              ...tripBoatPricingForm,
                                              price: e.target.value,
                                            })
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
                                          value={tripBoatPricingForm.capacity}
                                          onChange={(e) =>
                                            setTripBoatPricingForm({
                                              ...tripBoatPricingForm,
                                              capacity: e.target.value,
                                            })
                                          }
                                          placeholder="Override seats"
                                        />
                                      </Box>
                                    </HStack>
                                    <HStack width="100%" justify="flex-end">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setIsAddingTripBoatPricing(false)
                                        }
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleAddBoatPricing}
                                        disabled={
                                          !tripBoatPricingForm.ticket_type.trim() ||
                                          !tripBoatPricingForm.price ||
                                          Number.isNaN(
                                            Number.parseFloat(
                                              tripBoatPricingForm.price,
                                            ),
                                          )
                                        }
                                      >
                                        Add override
                                      </Button>
                                    </HStack>
                                  </VStack>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    mt={2}
                                    onClick={() =>
                                      setIsAddingTripBoatPricing(true)
                                    }
                                  >
                                    <FiPlus style={{ marginRight: "4px" }} />
                                    Add pricing override
                                  </Button>
                                )}
                              </VStack>
                            </Box>
                          )}
                        </Box>
                      )
                    })}
                  </VStack>
                ) : (
                  <Text mb={4}>No boats selected yet.</Text>
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
                        onChange={(
                          e: React.ChangeEvent<HTMLSelectElement>,
                        ) => setSelectedBoatId(e.target.value)}
                        disabled={mutation.isPending}
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
                        value={maxCapacity ?? ""}
                        onChange={(e) =>
                          setMaxCapacity(
                            e.target.value
                              ? Number.parseInt(e.target.value, 10)
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

            {/* Merchandise tab - same layout and options as Edit Trip */}
            <Tabs.Content value="pricing">
              <VStack gap={3} align="stretch">
                <Box>
                  <VStack align="stretch" gap={2}>
                    {selectedMerchandise.map((item) => {
                      const catalogItem = catalogMerchandise?.data?.find(
                        (m) => m.id === item.merchandise_id,
                      )
                      const price =
                        item.price_override ?? catalogItem?.price ?? 0
                      const hasVariations =
                        (catalogItem?.variations?.length ?? 0) > 0
                      return (
                        <HStack
                          key={item.merchandise_id}
                          justify="space-between"
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                        >
                          <VStack align="start" flex={1}>
                            <Text fontWeight="medium">{item.name}</Text>
                            <HStack
                              fontSize="sm"
                              color="gray.500"
                              gap={2}
                              flexWrap="wrap"
                            >
                              <Text>${formatCents(price)} each</Text>
                              {hasVariations ? (
                                <Text>
                                  {catalogItem!.variations!
                                    .map(
                                      (v) =>
                                        `${v.variant_value}: ${v.quantity_total - v.quantity_sold}`,
                                    )
                                    .join(", ")}
                                </Text>
                              ) : catalogItem?.variant_options ? (
                                <Text>
                                  Options: {catalogItem.variant_options} (qty{" "}
                                  {item.quantity_available_override ??
                                    catalogItem.quantity_available}
                                  )
                                </Text>
                              ) : (
                                <Text>
                                  Qty:{" "}
                                  {item.quantity_available_override ??
                                    catalogItem?.quantity_available ??
                                  0}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                          <IconButton
                            aria-label="Remove merchandise"
                            size="sm"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() =>
                              handleRemoveMerchandise(item.merchandise_id)
                            }
                          >
                            <FiTrash2 />
                          </IconButton>
                        </HStack>
                      )
                    })}
                    {selectedMerchandise.length === 0 &&
                      !isAddingMerchandise && (
                        <Text color="gray.500" textAlign="center" py={3}>
                          No merchandise configured for this trip
                        </Text>
                      )}
                  </VStack>
                  {isAddingMerchandise ? (
                    <Box mt={2} p={3} borderWidth="1px" borderRadius="md">
                      <VStack gap={3}>
                        <HStack width="100%" align="stretch" gap={4}>
                          <Box
                            flex={1}
                            display="flex"
                            flexDirection="column"
                            minW={0}
                          >
                            <Text fontSize="sm" mb={1}>
                              Catalog item
                            </Text>
                            {(() => {
                              const selected = catalogMerchandise?.data?.find(
                                (m) =>
                                  m.id === merchandiseForm.merchandise_id,
                              )
                              if (
                                !selected ||
                                (selected.variations?.length ?? 0) > 0
                              )
                                return null
                              return (
                                <Text
                                  fontSize="xs"
                                  color="gray.500"
                                  mt={1}
                                >
                                  No variants. Add variants in Merchandise
                                  catalog to show per-option availability.
                                </Text>
                              )
                            })()}
                            <Box flex={1} minHeight={2} />
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
                              {catalogMerchandise?.data?.map((m) => {
                                const hasVariations =
                                  (m.variations?.length ?? 0) > 0
                                const qtyLabel = hasVariations
                                  ? m.variations!
                                      .map(
                                        (v) =>
                                          `${v.variant_value}: ${v.quantity_total - v.quantity_sold}`,
                                      )
                                      .join(", ")
                                  : m.variant_options
                                    ? `${m.variant_options} (qty ${m.quantity_available})`
                                    : `qty ${m.quantity_available}`
                                return (
                                  <option key={m.id} value={m.id}>
                                    {m.name} — ${formatCents(m.price)} (
                                    {qtyLabel})
                                  </option>
                                )
                              })}
                            </NativeSelect>
                          </Box>
                          <Box
                            flex={1}
                            display="flex"
                            flexDirection="column"
                            minW={0}
                          >
                            <Text fontSize="sm" mb={1}>
                              Price override ($, optional)
                            </Text>
                            <Box flex={1} minHeight={2} />
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
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
                          <Box
                            flex={1}
                            display="flex"
                            flexDirection="column"
                            minW={0}
                          >
                            <Text fontSize="sm" mb={1}>
                              Quantity override (optional)
                            </Text>
                            {catalogMerchandise?.data?.find(
                              (m) => m.id === merchandiseForm.merchandise_id,
                            )?.variations?.length ? (
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                Cap on total for this trip. Per-variant
                                availability comes from catalog.
                              </Text>
                            ) : null}
                            <Box flex={1} minHeight={2} />
                            <Input
                              type="number"
                              min={0}
                              value={
                                merchandiseForm.quantity_available_override
                              }
                              onChange={(e) =>
                                setMerchandiseForm({
                                  ...merchandiseForm,
                                  quantity_available_override: e.target.value,
                                })
                              }
                              placeholder={
                                catalogMerchandise?.data?.find(
                                  (m) =>
                                    m.id === merchandiseForm.merchandise_id,
                                )?.variations?.length
                                  ? "Max total for trip"
                                  : "Use catalog qty"
                              }
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
                            colorPalette="blue"
                            onClick={handleAddMerchandise}
                            disabled={!merchandiseForm.merchandise_id}
                          >
                            Add Merchandise
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      mt={2}
                      onClick={() => setIsAddingMerchandise(true)}
                    >
                      <FiPlus style={{ marginRight: "4px" }} />
                      Add Merchandise
                    </Button>
                  )}
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
