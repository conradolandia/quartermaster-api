import { Button, Text, Textarea, VStack } from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
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
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { AddBookingItemsSection } from "./AddBookingItemsSection"
import { AddBookingTripSection } from "./AddBookingTripSection"
import { BookingCustomerFields } from "./shared/BookingCustomerFields"
import { BookingPricingSummary } from "./shared/BookingPricingSummary"
import { BookingStatusFields } from "./shared/BookingStatusFields"

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
  useDateFormatPreference()

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
  const [bookingStatus, setBookingStatus] = useState<
    "draft" | "confirmed"
  >("confirmed")
  const [paymentStatus, setPaymentStatus] = useState<
    "pending_payment" | "paid" | "free"
  >("paid")
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
      TripBoatsService.readEffectivePricing({
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
      first_name: "",
      last_name: "",
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
        tripId: selectedTripId || undefined,
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
      bookingStatus: "draft" | "confirmed"
      paymentStatus: "pending_payment" | "paid" | "free"
      sendConfirmationEmail: boolean
    }) => {
      // Create the booking
      const booking = await BookingsService.createBooking({
        requestBody: data.bookingData,
      })

      // Set payment_status and booking_status on create
      if (booking.id) {
        await BookingsService.updateBooking({
          bookingId: booking.id,
          requestBody: {
            payment_status: data.paymentStatus,
            booking_status: data.bookingStatus,
          },
        })
      }

      // Send confirmation email if requested (requires confirmed status and paid/free)
      const isPaidOrFree =
        data.paymentStatus === "paid" || data.paymentStatus === "free"
      const isConfirmed = data.bookingStatus === "confirmed"
      if (
        data.sendConfirmationEmail &&
        isPaidOrFree &&
        isConfirmed &&
        booking.confirmation_code
      ) {
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
      const isPaidOrFree = paymentStatus === "paid" || paymentStatus === "free"
      const isConfirmed = bookingStatus === "confirmed"
      showSuccessToast(
        isConfirmed && isPaidOrFree
          ? sendConfirmationEmail
            ? "Booking created, marked as paid, and confirmation email sent."
            : "Booking created and marked as paid successfully."
          : "Booking created successfully.",
      )
      reset()
      setSelectedTripId("")
      setTripPricing([])
      setTripMerchandise([])
      setSelectedItems([])
      setBookingStatus("confirmed")
      setPaymentStatus("paid")
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
    mutation.mutate({
      bookingData,
      bookingStatus,
      paymentStatus,
      sendConfirmationEmail,
    })
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
      setBookingStatus("confirmed")
      setPaymentStatus("paid")
      setSendConfirmationEmail(true)
    }
  }, [isOpen, reset])

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
              <AddBookingTripSection
                selectedTripId={selectedTripId}
                trips={tripsData?.data}
                tripBoats={tripBoats}
                boatNames={boatNames}
                selectedBoatId={selectedBoatId}
                onTripChange={handleTripSelection}
                onBoatChange={setSelectedBoatId}
              />

              <BookingCustomerFields
                register={register}
                errors={errors}
                required
              />

              {selectedTripId && (
                <AddBookingItemsSection
                  tripPricing={tripPricing}
                  tripMerchandise={tripMerchandise}
                  selectedItems={selectedItems}
                  merchandiseVariantByKey={merchandiseVariantByKey}
                  addTicketItem={addTicketItem}
                  addMerchandiseItem={addMerchandiseItem}
                  variantOptionsList={variantOptionsList}
                  ticketCapacityReachedForType={ticketCapacityReachedForType}
                  getItemDisplayName={getItemDisplayName}
                  updateItemQuantity={updateItemQuantity}
                  removeItem={removeItem}
                  setMerchandiseVariantByKey={setMerchandiseVariantByKey}
                />
              )}

              <BookingPricingSummary
                mode="create"
                subtotalCents={watch("subtotal")}
                discountAmountCents={watch("discount_amount")}
                taxAmountCents={watch("tax_amount")}
                tipAmountCents={watch("tip_amount")}
                totalAmountCents={watch("total_amount")}
                discountCode={discountCode}
                discountCodeError={discountCodeError}
                appliedDiscountCode={appliedDiscountCode}
                discountInputCents={discountInput}
                taxRatePercent={taxRatePercent}
                onDiscountCodeChange={setDiscountCode}
                onDiscountCodeBlur={() => validateDiscountCode(discountCode)}
                onDiscountCodeApply={() => validateDiscountCode(discountCode)}
                onDiscountOverrideChange={(cents) => {
                  setValue("discount_amount", cents)
                  setDiscountInput(cents)
                  if (appliedDiscountCode && cents !== discountInput) {
                    setAppliedDiscountCode(null)
                    setDiscountCode("")
                  }
                }}
                onTipChange={(cents) => setValue("tip_amount", cents)}
              />

              <BookingStatusFields
                mode="create"
                bookingStatus={bookingStatus}
                paymentStatus={paymentStatus}
                onBookingStatusChange={(v) =>
                  setBookingStatus(v as "draft" | "confirmed")
                }
                onPaymentStatusChange={(v) =>
                  setPaymentStatus(v as "pending_payment" | "paid" | "free")
                }
              />

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

              <Field>
                <Checkbox
                  checked={sendConfirmationEmail}
                  onCheckedChange={({ checked }) =>
                    setSendConfirmationEmail(checked === true)
                  }
                  disabled={
                    (paymentStatus !== "paid" && paymentStatus !== "free") ||
                    bookingStatus !== "confirmed"
                  }
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
