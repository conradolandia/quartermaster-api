import {
  Button,
  HStack,
  IconButton,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
  createListCollection,
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
  type EffectivePricingItem,
  JurisdictionsService,
  LaunchesService,
  MissionsService,
  type TripBoatPublicWithAvailability,
  TripBoatsService,
  TripMerchandiseService,
  type TripPublic,
  TripsService,
} from "@/client"
import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import { formatCents } from "@/utils"

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
import { formatDateTimeInLocationTz, parseApiDate } from "@/utils"

// In-memory cache to avoid re-fetching boat names we already resolved
const boatNameCache: Map<string, string> = new Map()

interface AddBookingProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Interface for trip merchandise data
interface TripMerchandiseData {
  id: string
  name: string
  description?: string | null
  price: number
  quantity_available: number
  variant_name?: string | null
  variant_options?: string | null
}

// Interface for selected booking item
interface SelectedBookingItem {
  trip_id: string
  item_type: string
  quantity: number
  price_per_unit: number
  merchandise_id?: string // For merchandise items
  variant_option?: string
}

const AddBooking = ({ isOpen, onClose, onSuccess }: AddBookingProps) => {
  const contentRef = useRef(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  // State for trip-based pricing
  const [selectedTripId, setSelectedTripId] = useState<string>("")
  const [tripPricing, setTripPricing] = useState<EffectivePricingItem[]>([])
  const [tripMerchandise, setTripMerchandise] = useState<TripMerchandiseData[]>(
    [],
  )
  const [selectedItems, setSelectedItems] = useState<SelectedBookingItem[]>([])
  const [tripBoats, setTripBoats] = useState<TripBoatPublicWithAvailability[]>(
    [],
  )
  const [boatNames, setBoatNames] = useState<Record<string, string>>({})
  const [selectedBoatId, setSelectedBoatId] = useState<string>("")
  const [discountInput, setDiscountInput] = useState<number>(0)
  const [discountCode, setDiscountCode] = useState<string>("")
  const [merchandiseVariantByKey, setMerchandiseVariantByKey] = useState<
    Record<string, string>
  >({})
  const [discountCodeError, setDiscountCodeError] = useState<string>("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null)
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(true) // Default to true for admin bookings
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState<boolean>(true)

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
    queryFn: () =>
      MissionsService.readMission({ missionId: tripData!.mission_id }),
    enabled: !!tripData?.mission_id,
  })

  // Get launch details
  const { data: launchData } = useQuery({
    queryKey: ["launch-details", missionData?.launch_id],
    queryFn: () =>
      LaunchesService.readLaunch({ launchId: missionData!.launch_id }),
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

  // Get effective pricing when trip and boat are selected
  const { data: pricingData } = useQuery({
    queryKey: ["effective-pricing", selectedTripId, selectedBoatId],
    queryFn: () =>
      TripBoatsService.readPublicEffectivePricing({
        tripId: selectedTripId,
        boatId: selectedBoatId,
      }),
    enabled: !!selectedTripId && !!selectedBoatId,
  })

  // Get trip merchandise when trip is selected
  const { data: merchandiseData } = useQuery({
    queryKey: ["trip-merchandise", selectedTripId],
    queryFn: () =>
      TripMerchandiseService.listTripMerchandise({ tripId: selectedTripId }),
    enabled: !!selectedTripId,
  })

  // Get trip boats when trip is selected (returns TripBoatPublicWithAvailability with remaining_capacity)
  useEffect(() => {
    if (!selectedTripId) {
      setTripBoats([])
      setBoatNames({})
      setSelectedBoatId("")
      return
    }
    TripBoatsService.readTripBoatsByTrip({ tripId: selectedTripId })
      .then((rows: TripBoatPublicWithAvailability[]) => {
        const list = Array.isArray(rows) ? rows : []
        setTripBoats(list)

        const map: Record<string, string> = {}
        const idsToFetch: string[] = []
        list.forEach((tb) => {
          const id = tb.boat_id
          const name = tb.boat?.name ?? boatNameCache.get(id)
          if (name) {
            map[id] = name
            boatNameCache.set(id, name)
          } else {
            idsToFetch.push(id)
          }
        })
        if (idsToFetch.length === 0) {
          setBoatNames(map)
          if (!selectedBoatId && list.length > 0) {
            setSelectedBoatId(list[0].boat_id)
          }
          return
        }
        Promise.all(
          idsToFetch.map((id) =>
            BoatsService.readBoat({ boatId: id }).then((boat) => {
              const name = boat.name
              boatNameCache.set(id, name)
              return { id, name }
            }),
          ),
        )
          .then((pairs) => {
            pairs.forEach((p) => {
              map[p.id] = p.name
            })
            setBoatNames(map)
            if (!selectedBoatId && list.length > 0) {
              setSelectedBoatId(list[0].boat_id)
            }
          })
          .catch(() => setBoatNames(map))
      })
      .catch(() => {
        setTripBoats([])
        setBoatNames({})
        setSelectedBoatId("")
      })
  }, [selectedTripId])

  // Update pricing when (trip, boat) effective pricing is fetched; clear when boat unset
  useEffect(() => {
    setTripPricing(selectedBoatId && pricingData ? pricingData : [])
  }, [pricingData, selectedBoatId])

  const tripTypeToLabel = (type: string): string => {
    if (type === "launch_viewing") return "Launch Viewing"
    if (type === "pre_launch") return "Pre-Launch"
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatTripOptionLabel = (trip: TripPublic): string => {
    const readableType = tripTypeToLabel(trip.type)
    const time = formatDateTimeInLocationTz(trip.departure_time, trip.timezone)
    if (trip.name?.trim()) {
      return `${trip.name.trim()} - ${readableType} (${time})`
    }
    return `${readableType} (${time})`
  }

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
      admin_notes: "",
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
        subtotalCents: subtotal,
      })

      setAppliedDiscountCode(discountCodeData)
      setDiscountCodeError("")

      // Discount: API returns discount_value as 0-1 for percentage, or cents for fixed_amount
      let calculatedDiscount = 0
      if (discountCodeData.discount_type === "percentage") {
        calculatedDiscount = Math.round(
          subtotal * discountCodeData.discount_value,
        )
        if (discountCodeData.max_discount_amount != null) {
          calculatedDiscount = Math.min(
            calculatedDiscount,
            discountCodeData.max_discount_amount,
          )
        }
      } else {
        calculatedDiscount = Math.round(discountCodeData.discount_value)
      }

      setDiscountInput(calculatedDiscount)
    } catch (error: any) {
      setDiscountCodeError(
        error.response?.data?.detail || "Invalid discount code",
      )
      setAppliedDiscountCode(null)
      setDiscountInput(0)
    }
  }

  // Auto-calculate subtotal, discount, tax_amount (from tax rate), and total based on selected items
  useEffect(() => {
    const calculatedSubtotal = selectedItems.reduce((sum, item) => {
      return sum + item.quantity * item.price_per_unit
    }, 0)

    // All amounts in cents
    const discount = discountInput || 0
    setValue("discount_amount", discount)

    const taxRate = (taxRatePercent || 0) / 100
    const afterDiscount = Math.max(0, calculatedSubtotal - discount)
    const taxAmount = Math.round(afterDiscount * taxRate)
    const calculatedTotal = afterDiscount + taxAmount + (watchedTipAmount || 0)

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
    mutationFn: async (data: {
      bookingData: BookingCreate
      markAsPaid: boolean
      sendConfirmationEmail: boolean
    }) => {
      // Create the booking
      const booking = await BookingsService.createBooking({
        requestBody: data.bookingData,
      })

      // If markAsPaid is true, update status to confirmed
      if (data.markAsPaid && booking.id) {
        await BookingsService.updateBooking({
          bookingId: booking.id,
          requestBody: { booking_status: "confirmed" },
        })
      }

      // Send confirmation email if requested (requires confirmed status)
      if (data.sendConfirmationEmail && data.markAsPaid && booking.confirmation_code) {
        await BookingsService.bookingPublicResendBookingConfirmationEmail({
          confirmationCode: booking.confirmation_code,
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
          ? sendConfirmationEmail
            ? "Booking created, marked as paid, and confirmation email sent."
            : "Booking created and marked as paid successfully."
          : "Booking created as draft successfully.",
      )
      reset()
      setSelectedTripId("")
      setTripPricing([])
      setTripMerchandise([])
      setSelectedItems([])
      setMarkAsPaid(true) // Reset to default
      setSendConfirmationEmail(true)
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
      variant_option: item.variant_option ?? null,
    }))

    // Generate confirmation code before submitting
    const bookingData = {
      ...data,
      confirmation_code: generateConfirmationCode(),
      items: bookingItems,
      discount_code_id: appliedDiscountCode?.id || null,
      admin_notes: data.admin_notes?.trim() || null,
    }
    mutation.mutate({ bookingData, markAsPaid, sendConfirmationEmail })
  }

  // Handle trip selection
  const handleTripSelection = (tripId: string) => {
    setSelectedTripId(tripId)
    setSelectedItems([]) // Clear selected items when trip changes
    setSelectedBoatId("")
  }

  const remainingForType = (ticketType: string) =>
    tripPricing.find((p) => p.ticket_type === ticketType)?.remaining ?? 0
  const currentQtyForTicketType = (ticketType: string) =>
    selectedItems
      .filter((item) => !item.merchandise_id && item.item_type === ticketType)
      .reduce((sum, item) => sum + item.quantity, 0)
  const ticketCapacityReachedForType = (ticketType: string) =>
    currentQtyForTicketType(ticketType) >= remainingForType(ticketType)

  // Add ticket item (merge into existing line by ticket type; item_type = ticket_type for API)
  const addTicketItem = (ticketType: string) => {
    if (ticketCapacityReachedForType(ticketType)) return
    const pricing = tripPricing.find((p) => p.ticket_type === ticketType)
    if (!pricing || remainingForType(ticketType) <= 0) return

    const existingItem = selectedItems.find(
      (item) => item.item_type === ticketType && !item.merchandise_id,
    )
    if (existingItem) {
      const newQty = currentQtyForTicketType(ticketType) + 1
      if (newQty > remainingForType(ticketType)) return
      setSelectedItems(
        selectedItems.map((item) =>
          item === existingItem
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      )
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          trip_id: selectedTripId,
          item_type: ticketType,
          quantity: 1,
          price_per_unit: pricing.price,
        },
      ])
    }
  }

  const variantOptionsList = (opts: string | null | undefined): string[] =>
    opts ? opts.split(",").map((o) => o.trim()).filter(Boolean) : []

  // Add merchandise item (optionally with variant)
  const addMerchandiseItem = (
    merchandiseId: string,
    variantOption?: string,
  ) => {
    const merchandise = tripMerchandise.find((m) => m.id === merchandiseId)
    if (!merchandise || merchandise.quantity_available <= 0) return
    const options = variantOptionsList(merchandise.variant_options)
    const hasVariants = options.length > 0
    if (hasVariants && (!variantOption || !options.includes(variantOption)))
      return

    const existingItem = selectedItems.find(
      (item) =>
        item.merchandise_id === merchandiseId &&
        (item.variant_option ?? undefined) === (variantOption ?? undefined),
    )
    if (existingItem) {
      if (existingItem.quantity >= merchandise.quantity_available) return
      setSelectedItems(
        selectedItems.map((item) =>
          item === existingItem
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      )
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          trip_id: selectedTripId,
          item_type: merchandise.name,
          quantity: 1,
          price_per_unit: merchandise.price,
          merchandise_id: merchandiseId,
          variant_option: variantOption,
        },
      ])
    }
  }

  // Update item quantity (cap ticket quantity by remaining per ticket type)
  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter((_, i) => i !== index))
      return
    }
    const item = selectedItems[index]
    let cappedQuantity = quantity
    if (item && !item.merchandise_id) {
      const pricing = tripPricing.find((p) => p.ticket_type === item.item_type)
      if (pricing) {
        const otherSameType = selectedItems
          .filter(
            (x, i) =>
              i !== index &&
              !x.merchandise_id &&
              x.item_type === item.item_type,
          )
          .reduce((sum, x) => sum + x.quantity, 0)
        cappedQuantity = Math.min(
          quantity,
          Math.max(0, pricing.remaining - otherSameType),
        )
      }
    }
    setSelectedItems(
      selectedItems.map((it, i) =>
        i === index ? { ...it, quantity: cappedQuantity } : it,
      ),
    )
  }

  // Remove item
  const removeItem = (index: number) => {
    const updatedItems = selectedItems.filter((_, i) => i !== index)
    setSelectedItems(updatedItems)
  }

  const getItemDisplayName = (item: SelectedBookingItem) => {
    if (item.merchandise_id) {
      const merchandise = tripMerchandise.find(
        (m) => m.id === item.merchandise_id,
      )
      const name = merchandise?.name || "Merchandise"
      return item.variant_option ? `${name} – ${item.variant_option}` : name
    }
    return item.item_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      reset()
      setSelectedTripId("")
      setTripPricing([])
      setTripMerchandise([])
      setSelectedItems([])
      setMarkAsPaid(true)
      setSendConfirmationEmail(true)
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
                      const departureTime = parseApiDate(trip.departure_time)
                      return departureTime >= new Date()
                    })
                    .map((trip: TripPublic) => (
                      <option key={trip.id} value={trip.id}>
                        {formatTripOptionLabel(trip)}
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
                        {boatNames[tb.boat_id] || tb.boat?.name || tb.boat_id} (
                        {tb.remaining_capacity} spots left)
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
                      message: "Billing address cannot exceed 1000 characters",
                    },
                  })}
                  placeholder="Billing Address"
                  rows={3}
                />
              </Field>

              <Field
                invalid={!!errors.admin_notes}
                errorText={errors.admin_notes?.message}
                label="Admin Notes"
                helperText="Admin only. Not visible to customers."
              >
                <Textarea
                  id="admin_notes"
                  {...register("admin_notes", {
                    maxLength: {
                      value: 2000,
                      message: "Admin notes cannot exceed 2000 characters",
                    },
                  })}
                  placeholder="Internal notes about this booking"
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
                        {tripPricing.map((pricing: EffectivePricingItem) => (
                          <Button
                            key={pricing.ticket_type}
                            size="sm"
                            variant="outline"
                            disabled={ticketCapacityReachedForType(
                              pricing.ticket_type,
                            )}
                            onClick={() => addTicketItem(pricing.ticket_type)}
                          >
                            <FiPlus style={{ marginRight: "4px" }} />
                            {pricing.ticket_type
                              .replace("_", " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
                            - ${formatCents(pricing.price)}
                            {pricing.remaining >= 0 && (
                              <> ({pricing.remaining} left)</>
                            )}
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
                      <VStack gap={2} align="stretch">
                        {tripMerchandise.map((merchandise) => {
                          const options = variantOptionsList(
                            merchandise.variant_options,
                          )
                          const hasVariants = options.length > 0
                          const selectedVariant =
                            merchandiseVariantByKey[merchandise.id] ??
                            options[0]
                          return (
                            <HStack
                              key={merchandise.id}
                              gap={2}
                              align="center"
                              flexWrap="wrap"
                            >
                              <Text fontSize="sm">
                                {merchandise.name} - $
                                {formatCents(merchandise.price)} (
                                {merchandise.quantity_available} available)
                              </Text>
                              {hasVariants && (
                                <Select.Root
                                  size="sm"
                                  width="min(100px, 20vw)"
                                  value={[selectedVariant]}
                                  onValueChange={(e) =>
                                    setMerchandiseVariantByKey((prev) => ({
                                      ...prev,
                                      [merchandise.id]: e.value[0] ?? "",
                                    }))
                                  }
                                  collection={createListCollection({
                                    items: options.map((o) => ({
                                      label: o,
                                      value: o,
                                    })),
                                  })}
                                >
                                  <Select.Control>
                                    <Select.Trigger>
                                      <Select.ValueText placeholder="Variant" />
                                    </Select.Trigger>
                                  </Select.Control>
                                  <Select.Positioner>
                                    <Select.Content>
                                      {options.map((o) => (
                                        <Select.Item
                                          key={o}
                                          item={{ label: o, value: o }}
                                        >
                                          {o}
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select.Positioner>
                                </Select.Root>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  addMerchandiseItem(
                                    merchandise.id,
                                    hasVariants ? selectedVariant : undefined,
                                  )
                                }
                                disabled={
                                  merchandise.quantity_available <= 0 ||
                                  (hasVariants && !selectedVariant)
                                }
                              >
                                <FiPlus style={{ marginRight: "4px" }} />
                                Add
                              </Button>
                            </HStack>
                          )
                        })}
                      </VStack>
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
                              ${formatCents(item.price_per_unit)} each
                            </Text>
                          </VStack>
                          <HStack gap={2}>
                            <Input
                              type="number"
                              min={0}
                              max={
                                item.merchandise_id
                                  ? tripMerchandise.find(
                                      (m) => m.id === item.merchandise_id,
                                    )?.quantity_available ?? 999
                                  : (() => {
                                      const pricing = tripPricing.find(
                                        (p) => p.ticket_type === item.item_type,
                                      )
                                      if (!pricing) return 999
                                      const otherSameType = selectedItems
                                        .filter(
                                          (x, i) =>
                                            i !== index &&
                                            !x.merchandise_id &&
                                            x.item_type === item.item_type,
                                        )
                                        .reduce((sum, x) => sum + x.quantity, 0)
                                      return Math.max(
                                        0,
                                        pricing.remaining - otherSameType,
                                      )
                                    })()
                              }
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQuantity(
                                  index,
                                  Number.parseInt(e.target.value) || 0,
                                )
                              }
                              style={{ width: "60px" }}
                            />
                            <Text fontSize="sm" fontWeight="medium">
                              $
                              {formatCents(item.quantity * item.price_per_unit)}
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
                  <Text>${formatCents(watch("subtotal"))}</Text>
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
                        -${formatCents(discountInput)}
                      </Text>
                    </HStack>
                  )}
                </VStack>
                <HStack justify="space-between" width="100%">
                  <Text>Discount override (optional, $):</Text>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={watch("discount_amount") / 100}
                    onChange={(e) => {
                      const dollars = Number.parseFloat(e.target.value) || 0
                      const cents = Math.round(dollars * 100)
                      setValue("discount_amount", cents)
                      setDiscountInput(cents)
                      if (appliedDiscountCode && cents !== discountInput) {
                        setAppliedDiscountCode(null)
                        setDiscountCode("")
                      }
                    }}
                    style={{ width: "100px" }}
                  />
                </HStack>
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
                  <Text>${formatCents(watch("tax_amount"))}</Text>
                </HStack>
                <HStack justify="space-between" width="100%">
                  <HStack gap={1}>
                    <StarFleetTipLabel showColon showTooltip={false} />
                    <Text as="span">($)</Text>
                  </HStack>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={watch("tip_amount") / 100}
                    onChange={(e) =>
                      setValue(
                        "tip_amount",
                        Math.round(
                          (Number.parseFloat(e.target.value) || 0) * 100,
                        ),
                      )
                    }
                    style={{ width: "100px" }}
                  />
                </HStack>
                <HStack justify="space-between" width="100%" fontWeight="bold">
                  <Text>Total:</Text>
                  <Text>${formatCents(watch("total_amount"))}</Text>
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
                      message: "Special requests cannot exceed 1000 characters",
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

              <Field>
                <Checkbox
                  checked={sendConfirmationEmail}
                  onCheckedChange={({ checked }) =>
                    setSendConfirmationEmail(checked === true)
                  }
                  disabled={!markAsPaid}
                >
                  Send confirmation email
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
                selectedItems.length === 0 || !selectedTripId || !selectedBoatId
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
