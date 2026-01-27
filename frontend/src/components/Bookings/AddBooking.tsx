import {
  Button,
  HStack,
  IconButton,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FiPlus, FiTrash2 } from "react-icons/fi"
import { Checkbox } from "../ui/checkbox"

import {
  type ApiError,
  BoatsService,
  type BookingCreate,
  type BookingItemCreate,
  BookingsService,
  DiscountCodesService,
  JurisdictionsService,
  LaunchesService,
  MissionsService,
  TripBoatsService,
  TripMerchandiseService,
  TripPricingService,
  type TripPublic,
  TripsService,
} from "@/client"

// Custom type for form with optional items
type BookingFormData = Omit<BookingCreate, "items"> & {
  items?: BookingItemCreate[]
}
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import useCustomToast from "@/hooks/useCustomToast"

// In-memory cache to avoid re-fetching boat names we already resolved
const boatNameCache: Map<string, string> = new Map()

interface AddBookingProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Interface for trip pricing data
interface TripPricingData {
  id: string
  ticket_type: string
  price: number
}

// Interface for trip merchandise data
interface TripMerchandiseData {
  id: string
  name: string
  description?: string | null
  price: number
  quantity_available: number
}

// Interface for selected booking item
interface SelectedBookingItem {
  trip_id: string
  item_type: string
  quantity: number
  price_per_unit: number
  merchandise_id?: string // For merchandise items
}

const AddBooking = ({ isOpen, onClose, onSuccess }: AddBookingProps) => {
  const contentRef = useRef(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  // State for trip-based pricing
  const [selectedTripId, setSelectedTripId] = useState<string>("")
  const [tripPricing, setTripPricing] = useState<TripPricingData[]>([])
  const [tripMerchandise, setTripMerchandise] = useState<TripMerchandiseData[]>(
    [],
  )
  const [selectedItems, setSelectedItems] = useState<SelectedBookingItem[]>([])
  const [tripBoats, setTripBoats] = useState<{ boat_id: string }[]>([])
  const [boatNames, setBoatNames] = useState<Record<string, string>>({})
  const [selectedBoatId, setSelectedBoatId] = useState<string>("")
  const [discountInput, setDiscountInput] = useState<number>(0)
  const [discountCode, setDiscountCode] = useState<string>("")
  const [discountCodeError, setDiscountCodeError] = useState<string>("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null)
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(true) // Default to true for admin bookings

  // Get trips for dropdown
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  // Get trip details when trip is selected
  const { data: tripData } = useQuery({
    queryKey: ["trip-details", selectedTripId],
    queryFn: () => TripsService.readTrip({ tripId: selectedTripId }),
    enabled: !!selectedTripId,
  })

  // Get mission details
  const { data: missionData } = useQuery({
    queryKey: ["mission-details", tripData?.mission_id],
    queryFn: () => MissionsService.readMission({ missionId: tripData!.mission_id }),
    enabled: !!tripData?.mission_id,
  })

  // Get launch details
  const { data: launchData } = useQuery({
    queryKey: ["launch-details", missionData?.launch_id],
    queryFn: () => LaunchesService.readLaunch({ launchId: missionData!.launch_id }),
    enabled: !!missionData?.launch_id,
  })

  // Get jurisdiction for tax rate
  const { data: jurisdictionsData } = useQuery({
    queryKey: ["jurisdictions-by-location", launchData?.location_id],
    queryFn: () =>
      JurisdictionsService.readJurisdictions({
        locationId: launchData!.location_id,
        limit: 100,
      }),
    enabled: !!launchData?.location_id,
  })

  // Get trip pricing when trip is selected
  const { data: pricingData } = useQuery({
    queryKey: ["trip-pricing", selectedTripId],
    queryFn: () =>
      TripPricingService.listTripPricing({ tripId: selectedTripId }),
    enabled: !!selectedTripId,
  })

  // Get trip merchandise when trip is selected
  const { data: merchandiseData } = useQuery({
    queryKey: ["trip-merchandise", selectedTripId],
    queryFn: () =>
      TripMerchandiseService.listTripMerchandise({ tripId: selectedTripId }),
    enabled: !!selectedTripId,
  })

  // Get trip boats when trip is selected
  useEffect(() => {
    if (!selectedTripId) {
      setTripBoats([])
      setBoatNames({})
      setSelectedBoatId("")
      return
    }
    TripBoatsService.readTripBoatsByTrip({ tripId: selectedTripId })
      .then((res: any) => {
        const rows = Array.isArray(res) ? res : []
        // Normalize to array of { boat_id }
        const normalized: { boat_id: string }[] = rows
          .map((r: any) => ({
            boat_id: r.boat_id || r.boatId || r.boat?.id || "",
          }))
          .filter((r: { boat_id: string }) => !!r.boat_id)
        setTripBoats(normalized)

        // Resolve boat names using a simple cache to minimize requests
        const uniqueBoatIds = Array.from(
          new Set(normalized.map((b) => b.boat_id)),
        )
        const cachedPairs: { id: string; name: string }[] = []
        const idsToFetch: string[] = []
        uniqueBoatIds.forEach((id) => {
          const cached = boatNameCache.get(id)
          if (cached) {
            cachedPairs.push({ id, name: cached })
          } else {
            idsToFetch.push(id)
          }
        })

        const fetchPromises = idsToFetch.map((id: string) =>
          BoatsService.readBoat({ boatId: id }).then((boat: any) => {
            const name = boat.name
            boatNameCache.set(id, name)
            return { id, name }
          }),
        )

        Promise.all(fetchPromises)
          .then((fetchedPairs) => {
            const allPairs = [...cachedPairs, ...fetchedPairs]
            const map: Record<string, string> = {}
            allPairs.forEach((p) => {
              map[p.id] = p.name
            })
            setBoatNames(map)
            // Auto-select first if none selected
            if (!selectedBoatId && uniqueBoatIds.length > 0) {
              setSelectedBoatId(uniqueBoatIds[0])
            }
          })
          .catch(() => {
            const map: Record<string, string> = {}
            cachedPairs.forEach((p) => {
              map[p.id] = p.name
            })
            setBoatNames(map)
          })
      })
      .catch(() => {
        setTripBoats([])
        setBoatNames({})
        setSelectedBoatId("")
      })
  }, [selectedTripId])

  // Update pricing and merchandise when data is fetched
  useEffect(() => {
    if (pricingData) {
      setTripPricing(pricingData)
    }
  }, [pricingData])

  useEffect(() => {
    if (merchandiseData) {
      setTripMerchandise(merchandiseData)
    }
  }, [merchandiseData])

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      confirmation_code: "",
      user_name: "",
      user_email: "",
      user_phone: "",
      billing_address: "",
      subtotal: 0,
      discount_amount: 0,
      tax_amount: 0,
      tip_amount: 0,
      total_amount: 0,
      special_requests: "",
      launch_updates_pref: false,
    },
  })

  // Get tax rate from jurisdiction (convert from decimal to percentage)
  const taxRatePercent = jurisdictionsData?.data?.[0]?.sales_tax_rate
    ? jurisdictionsData.data[0].sales_tax_rate * 100
    : 0

  // Watch form values for auto-calculation
  const watchedTipAmount = watch("tip_amount")

  // Validate discount code
  const validateDiscountCode = async (code: string) => {
    if (!code.trim()) {
      setDiscountCodeError("")
      setAppliedDiscountCode(null)
      setDiscountInput(0)
      return
    }

    try {
      const subtotal = selectedItems.reduce((sum, item) => {
        return sum + item.quantity * item.price_per_unit
      }, 0)

      const discountCodeData = await DiscountCodesService.validateDiscountCode({
        code: code.trim(),
        subtotal: subtotal,
      })

      setAppliedDiscountCode(discountCodeData)
      setDiscountCodeError("")

      // Calculate discount amount based on code type
      let calculatedDiscount = 0
      if (discountCodeData.discount_type === "percentage") {
        calculatedDiscount = (subtotal * discountCodeData.discount_value) / 100
        if (discountCodeData.max_discount_amount) {
          calculatedDiscount = Math.min(calculatedDiscount, discountCodeData.max_discount_amount)
        }
      } else {
        calculatedDiscount = discountCodeData.discount_value
      }

      setDiscountInput(calculatedDiscount)
    } catch (error: any) {
      setDiscountCodeError(error.response?.data?.detail || "Invalid discount code")
      setAppliedDiscountCode(null)
      setDiscountInput(0)
    }
  }

  // Auto-calculate subtotal, discount, tax_amount (from tax rate), and total based on selected items
  useEffect(() => {
    const calculatedSubtotal = selectedItems.reduce((sum, item) => {
      return sum + item.quantity * item.price_per_unit
    }, 0)

    // Compute discount in dollars from discount code input
    const discount = discountInput || 0
    // Sync computed discount dollars to the form field expected by backend
    setValue("discount_amount", discount)

    // Calculate in order: subtotal → discount → tip → tax (on subtotal - discount + tip)
    const subtotalAfterDiscount = Math.max(0, calculatedSubtotal - discount)
    const amountAfterDiscountAndTip = subtotalAfterDiscount + (watchedTipAmount || 0)
    // Tax calculated after discount and tip are applied
    const taxAmount = Math.max(
      0,
      Number(
        ((amountAfterDiscountAndTip * (taxRatePercent || 0)) / 100).toFixed(2),
      ),
    )
    const calculatedTotal = amountAfterDiscountAndTip + taxAmount

    setValue("subtotal", calculatedSubtotal)
    setValue("tax_amount", taxAmount)
    setValue("total_amount", Math.max(0, calculatedTotal))
  }, [
    selectedItems,
    discountInput,
    watchedTipAmount,
    taxRatePercent,
    setValue,
    appliedDiscountCode,
  ])

  // Generate confirmation code
  const generateConfirmationCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase()
  }

  const mutation = useMutation({
    mutationFn: async (data: { bookingData: BookingCreate; markAsPaid: boolean }) => {
      // Create the booking
      const booking = await BookingsService.createBooking({
        requestBody: data.bookingData,
      })

      // If markAsPaid is true, update status to confirmed
      if (data.markAsPaid && booking.id) {
        await BookingsService.updateBooking({
          bookingId: booking.id,
          requestBody: { status: "confirmed" },
        })
      }

      return booking
    },
    onSuccess: async () => {
      // Backend decrements inventory and validates pricing atomically
      queryClient.invalidateQueries({
        queryKey: ["trip-merchandise", selectedTripId],
      })
      showSuccessToast(
        markAsPaid
          ? "Booking created and marked as paid successfully."
          : "Booking created as draft successfully."
      )
      reset()
      setSelectedTripId("")
      setTripPricing([])
      setTripMerchandise([])
      setSelectedItems([])
      setMarkAsPaid(true) // Reset to default
      onSuccess()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
  })

  const onSubmit: SubmitHandler<BookingFormData> = async (data) => {
    // Convert selected items to booking items format
    const bookingItems: BookingItemCreate[] = selectedItems.map((item) => ({
      trip_id: item.trip_id,
      boat_id: selectedBoatId,
      trip_merchandise_id: item.merchandise_id || null,
      item_type: item.item_type,
      quantity: item.quantity,
      price_per_unit: item.price_per_unit,
      status: "active",
      refund_reason: null,
      refund_notes: null,
    }))

    // Generate confirmation code before submitting
    const bookingData = {
      ...data,
      confirmation_code: generateConfirmationCode(),
      items: bookingItems,
      discount_code_id: appliedDiscountCode?.id || null,
    }
    mutation.mutate({ bookingData, markAsPaid })
  }

  // Handle trip selection
  const handleTripSelection = (tripId: string) => {
    setSelectedTripId(tripId)
    setSelectedItems([]) // Clear selected items when trip changes
    setSelectedBoatId("")
  }

  // Add ticket item
  const addTicketItem = (ticketType: string) => {
    const pricing = tripPricing.find((p) => p.ticket_type === ticketType)
    if (!pricing) return

    const newItem: SelectedBookingItem = {
      trip_id: selectedTripId,
      item_type: `${ticketType}_ticket`,
      quantity: 1,
      price_per_unit: pricing.price,
    }

    setSelectedItems([...selectedItems, newItem])
  }

  // Add merchandise item
  const addMerchandiseItem = (merchandiseId: string) => {
    const merchandise = tripMerchandise.find((m) => m.id === merchandiseId)
    if (!merchandise) return

    const newItem: SelectedBookingItem = {
      trip_id: selectedTripId,
      item_type: merchandise.name,
      quantity: 1,
      price_per_unit: merchandise.price,
      merchandise_id: merchandiseId,
    }

    setSelectedItems([...selectedItems, newItem])
  }

  // Update item quantity
  const updateItemQuantity = (index: number, quantity: number) => {
    const updatedItems = [...selectedItems]
    updatedItems[index].quantity = quantity
    setSelectedItems(updatedItems)
  }

  // Remove item
  const removeItem = (index: number) => {
    const updatedItems = selectedItems.filter((_, i) => i !== index)
    setSelectedItems(updatedItems)
  }

  // Get display name for item type
  const getItemDisplayName = (item: SelectedBookingItem) => {
    if (item.merchandise_id) {
      const merchandise = tripMerchandise.find(
        (m) => m.id === item.merchandise_id,
      )
      return merchandise?.name || "Merchandise"
    }

    return item.item_type
  }

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      reset()
      setSelectedTripId("")
      setTripPricing([])
      setTripMerchandise([])
      setSelectedItems([])
    }
  }, [isOpen, reset])

  const handleError = (error: ApiError) => {
    console.error("Booking creation error:", error)
  }

  return (
    <DialogRoot
      size={{ base: "lg", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Booking</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>
                Add a new booking by selecting a trip and items. A confirmation
                code will be auto-generated.
              </Text>
              <VStack gap={4}>
                {/* Trip Selection */}
                <Field label="Select Trip" required>
                  <NativeSelect
                    value={selectedTripId}
                    onChange={(e) => {
                      handleTripSelection(e.target.value)
                    }}
                  >
                    <option value="">Select a trip...</option>
                    {tripsData?.data
                      ?.filter((trip: TripPublic) => {
                        if (!trip.departure_time) return false
                        const departureTime = new Date(trip.departure_time)
                        return departureTime >= new Date()
                      })
                      .map((trip: TripPublic) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.type} -{" "}
                          {new Date(trip.departure_time).toLocaleDateString()}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>

                {selectedTripId && tripBoats.length > 0 && (
                  <Field label="Assign Boat" required>
                    <NativeSelect
                      value={selectedBoatId}
                      onChange={(e) => setSelectedBoatId(e.target.value)}
                    >
                      {tripBoats.map((tb, idx) => (
                        <option key={`${tb.boat_id}-${idx}`} value={tb.boat_id}>
                          {boatNames[tb.boat_id] || tb.boat_id}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}

                {/* Customer Information */}
                <Field
                  invalid={!!errors.user_name}
                  errorText={errors.user_name?.message}
                  label="Customer Name"
                  required
                >
                  <Input
                    id="user_name"
                    {...register("user_name", {
                      required: "Customer name is required",
                      maxLength: {
                        value: 255,
                        message: "Customer name cannot exceed 255 characters",
                      },
                    })}
                    placeholder="Customer Name"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.user_email}
                  errorText={errors.user_email?.message}
                  label="Customer Email"
                  required
                >
                  <Input
                    id="user_email"
                    {...register("user_email", {
                      required: "Customer email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                      maxLength: {
                        value: 255,
                        message: "Customer email cannot exceed 255 characters",
                      },
                    })}
                    placeholder="customer@example.com"
                    type="email"
                  />
                </Field>

                <Field
                  invalid={!!errors.user_phone}
                  errorText={errors.user_phone?.message}
                  label="Customer Phone"
                  required
                >
                  <Input
                    id="user_phone"
                    {...register("user_phone", {
                      required: "Customer phone is required",
                      maxLength: {
                        value: 40,
                        message: "Customer phone cannot exceed 40 characters",
                      },
                    })}
                    placeholder="Customer Phone"
                    type="tel"
                  />
                </Field>

                <Field
                  invalid={!!errors.billing_address}
                  errorText={errors.billing_address?.message}
                  label="Billing Address"
                  required
                >
                  <Textarea
                    id="billing_address"
                    {...register("billing_address", {
                      required: "Billing address is required",
                      maxLength: {
                        value: 1000,
                        message:
                          "Billing address cannot exceed 1000 characters",
                      },
                    })}
                    placeholder="Billing Address"
                    rows={3}
                  />
                </Field>

                {/* Item Selection - Only show if trip is selected */}
                {selectedTripId && (
                  <VStack gap={4} width="100%">
                    <Text fontWeight="bold">Select Items</Text>

                    {/* Tickets */}
                    {tripPricing.length > 0 && (
                      <VStack
                        gap={2}
                        width="100%"
                        p={3}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                      >
                        <Text fontWeight="medium">Tickets</Text>
                        <HStack gap={2} flexWrap="wrap">
                          {tripPricing.map((pricing) => (
                            <Button
                              key={pricing.ticket_type}
                              size="sm"
                              variant="outline"
                              onClick={() => addTicketItem(pricing.ticket_type)}
                            >
                              <FiPlus style={{ marginRight: "4px" }} />
                              {pricing.ticket_type
                                .replace("_", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
                              - ${pricing.price}
                            </Button>
                          ))}
                        </HStack>
                      </VStack>
                    )}

                    {/* Merchandise */}
                    {tripMerchandise.length > 0 && (
                      <VStack
                        gap={2}
                        width="100%"
                        p={3}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                      >
                        <Text fontWeight="medium">Merchandise</Text>
                        <HStack gap={2} flexWrap="wrap">
                          {tripMerchandise.map((merchandise) => (
                            <Button
                              key={merchandise.id}
                              size="sm"
                              variant="outline"
                              onClick={() => addMerchandiseItem(merchandise.id)}
                              disabled={merchandise.quantity_available <= 0}
                            >
                              <FiPlus style={{ marginRight: "4px" }} />
                              {merchandise.name} - ${merchandise.price} (
                              {merchandise.quantity_available} available)
                            </Button>
                          ))}
                        </HStack>
                      </VStack>
                    )}

                    {/* Selected Items */}
                    {selectedItems.length > 0 && (
                      <VStack
                        gap={2}
                        width="100%"
                        p={3}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                      >
                        <Text fontWeight="medium">Selected Items</Text>
                        {selectedItems.map((item, index) => (
                          <HStack
                            key={index}
                            width="100%"
                            justify="space-between"
                          >
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                {getItemDisplayName(item)}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                ${item.price_per_unit} each
                              </Text>
                            </VStack>
                            <HStack gap={2}>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemQuantity(
                                    index,
                                    Number.parseInt(e.target.value) || 1,
                                  )
                                }
                                style={{ width: "60px" }}
                              />
                              <Text fontSize="sm" fontWeight="medium">
                                $
                                {(item.quantity * item.price_per_unit).toFixed(
                                  2,
                                )}
                              </Text>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => removeItem(index)}
                                children={<FiTrash2 />}
                              />
                            </HStack>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </VStack>
                )}

                {/* Pricing Summary */}
                <VStack
                  gap={3}
                  width="100%"
                  p={4}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="md"
                >
                  <Text fontWeight="bold">Pricing Summary</Text>
                  <HStack justify="space-between" width="100%">
                    <Text>Subtotal:</Text>
                    <Text>${watch("subtotal").toFixed(2)}</Text>
                  </HStack>
                  <VStack align="stretch" gap={2} width="100%">
                    <HStack justify="space-between">
                      <Text>Discount Code:</Text>
                      <HStack gap={2}>
                        <Input
                          placeholder="Enter code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          onBlur={() => validateDiscountCode(discountCode)}
                          style={{ width: "120px" }}
                          borderColor={discountCodeError ? "red.500" : undefined}
                        />
                        <Button
                          size="sm"
                          onClick={() => validateDiscountCode(discountCode)}
                          disabled={!discountCode.trim()}
                        >
                          Apply
                        </Button>
                      </HStack>
                    </HStack>
                    {discountCodeError && (
                      <Text fontSize="sm" color="red.500">
                        {discountCodeError}
                      </Text>
                    )}
                    {appliedDiscountCode && (
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="green.500">
                          {appliedDiscountCode.code} applied
                        </Text>
                        <Text fontSize="sm" color="green.500">
                          -${discountInput.toFixed(2)}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                  <HStack justify="space-between" width="100%">
                    <Text>Tax Rate:</Text>
                    <Text>
                      {taxRatePercent > 0
                        ? `${taxRatePercent.toFixed(2)}%`
                        : "N/A - No jurisdiction set"}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" width="100%">
                    <Text>Tax Amount:</Text>
                    <Text>${(watch("tax_amount") || 0).toFixed(2)}</Text>
                  </HStack>
                  <HStack justify="space-between" width="100%">
                    <Text>Tip:</Text>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={watch("tip_amount")}
                      onChange={(e) =>
                        setValue(
                          "tip_amount",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      style={{ width: "100px" }}
                    />
                  </HStack>
                  <HStack justify="space-between" width="100%">
                    <Text>Discount:</Text>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={watch("discount_amount")}
                      onChange={(e) => {
                        const newDiscount = Number.parseFloat(e.target.value) || 0
                        setValue("discount_amount", newDiscount)
                        // Sync to discountInput to keep them in sync
                        setDiscountInput(newDiscount)
                        // Clear applied discount code if manually edited
                        if (appliedDiscountCode && newDiscount !== discountInput) {
                          setAppliedDiscountCode(null)
                          setDiscountCode("")
                        }
                      }}
                      style={{ width: "100px" }}
                    />
                  </HStack>
                  <HStack
                    justify="space-between"
                    width="100%"
                    fontWeight="bold"
                  >
                    <Text>Total:</Text>
                    <Text>${watch("total_amount").toFixed(2)}</Text>
                  </HStack>
                </VStack>

                {/* Additional Fields */}
                <Field
                  invalid={!!errors.special_requests}
                  errorText={errors.special_requests?.message}
                  label="Special Requests"
                >
                  <Textarea
                    id="special_requests"
                    {...register("special_requests", {
                      maxLength: {
                        value: 1000,
                        message:
                          "Special requests cannot exceed 1000 characters",
                      },
                    })}
                    placeholder="Any special requests or notes"
                    rows={3}
                  />
                </Field>

                <Controller
                  name="launch_updates_pref"
                  control={control}
                  render={({ field }) => (
                    <Field
                      invalid={!!errors.launch_updates_pref}
                      errorText={errors.launch_updates_pref?.message}
                    >
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={({ checked }) =>
                          field.onChange(checked === true)
                        }
                      >
                        Send launch updates
                      </Checkbox>
                    </Field>
                  )}
                />

                {/* Mark as paid checkbox for admin bookings */}
                <Field>
                  <Checkbox
                    checked={markAsPaid}
                    onCheckedChange={({ checked }) =>
                      setMarkAsPaid(checked === true)
                    }
                  >
                    Mark as paid/confirmed
                  </Checkbox>
                </Field>
              </VStack>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                loading={isSubmitting}
                disabled={
                  selectedItems.length === 0 ||
                  !selectedTripId ||
                  !selectedBoatId
                }
              >
                Create Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </DialogRoot>
  )
}

export default AddBooking
