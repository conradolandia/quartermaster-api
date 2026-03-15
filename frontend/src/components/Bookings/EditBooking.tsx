import {
  type ApiError,
  BoatsService,
  type BookingItemPublic,
  type BookingPublic,
  type BookingUpdate,
  BookingsService,
  TripsService,
  TripBoatsService,
} from "@/client"
import { Checkbox } from "@/components/ui/checkbox"
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
import { BookingCustomerFields } from "./shared/BookingCustomerFields"
import { BookingPricingSummary } from "./shared/BookingPricingSummary"
import { BookingStatusFields } from "./shared/BookingStatusFields"
import { BoatChangeTypeDialog } from "./BoatChangeTypeDialog"
import { EditBookingMerchandiseSection } from "./EditBookingMerchandiseSection"
import { EditBookingTicketsSection } from "./EditBookingTicketsSection"
import { getTripName } from "./types"
import {
  Box,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Controller,
  type SubmitHandler,
  useFieldArray,
  useForm,
} from "react-hook-form"

interface EditBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const EditBooking = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: EditBookingProps) => {
  const contentRef = useRef(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  useDateFormatPreference()

  // Get trips for display
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  // Get boats for display
  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
  })

  const uniqueTripIds = useMemo(() => {
    if (!booking?.items) return []
    const ids = new Set<string>()
    for (const i of booking.items) {
      if (!i.trip_merchandise_id && i.trip_id) ids.add(i.trip_id)
    }
    return Array.from(ids)
  }, [booking?.items])

  const tripBoatsQueries = useQueries({
    queries: uniqueTripIds.map((tripId) => ({
      queryKey: ["trip-boats", tripId],
      queryFn: () =>
        TripBoatsService.readTripBoatsByTrip({ tripId, limit: 100 }),
      enabled: isOpen && !!tripId,
    })),
  })

  const boatsByTripId = useMemo(() => {
    const map: Record<string, { boat_id: string; name: string }[]> = {}
    uniqueTripIds.forEach((tripId, i) => {
      const q = tripBoatsQueries[i]
      if (q.data && Array.isArray(q.data))
        map[tripId] = (q.data as { boat_id: string; boat: { name: string } }[]).map(
          (tb) => ({ boat_id: tb.boat_id, name: tb.boat?.name ?? tb.boat_id }),
        )
    })
    return map
  }, [uniqueTripIds, tripBoatsQueries])

  const allPricingKeys = useMemo(() => {
    const keys: { tripId: string; boatId: string }[] = []
    uniqueTripIds.forEach((tripId, i) => {
      const q = tripBoatsQueries[i]
      if (q.data && Array.isArray(q.data))
        for (const tb of q.data as { boat_id: string }[])
          keys.push({ tripId, boatId: tb.boat_id })
    })
    return keys
  }, [uniqueTripIds, tripBoatsQueries])

  const pricingQueries = useQueries({
    queries: allPricingKeys.map(({ tripId, boatId }) => ({
      queryKey: ["effective-pricing", tripId, boatId],
      queryFn: () =>
        TripBoatsService.readEffectivePricing({ tripId, boatId }),
      enabled: isOpen && !!tripId && !!boatId,
    })),
  })

  const pricingByKey = useMemo(() => {
    const map: Record<string, { ticket_type: string; price: number }[]> = {}
    allPricingKeys.forEach((k, i) => {
      const q = pricingQueries[i]
      const key = `${k.tripId}/${k.boatId}`
      if (q.data && Array.isArray(q.data))
        map[key] = q.data as { ticket_type: string; price: number }[]
    })
    return map
  }, [allPricingKeys, pricingQueries])

  const updateItemTypeMutation = useMutation({
    mutationFn: ({
      itemId,
      itemType,
    }: {
      itemId: string
      itemType: string
    }) =>
      BookingsService.updateBookingItem({
        bookingId: booking.id,
        itemId,
        requestBody: { item_type: itemType },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["booking", booking.confirmation_code],
        updated,
      )
      showSuccessToast("Ticket type updated")
      onSuccess()
    },
    onError: handleError,
  })

  const updateItemBoatMutation = useMutation({
    mutationFn: ({
      itemId,
      boatId,
      itemType,
    }: {
      itemId: string
      boatId: string
      itemType?: string
    }) =>
      BookingsService.updateBookingItem({
        bookingId: booking.id,
        itemId,
        requestBody: {
          boat_id: boatId,
          ...(itemType != null && { item_type: itemType }),
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["booking", booking.confirmation_code],
        updated,
      )
      showSuccessToast("Boat updated")
      onSuccess()
    },
    onError: handleError,
  })

  const [pendingBoatChange, setPendingBoatChange] = useState<{
    itemId: string
    item: BookingItemPublic
    newBoatId: string
    newBoatName: string
    ticketTypeOptions: { ticket_type: string; price: number }[]
  } | null>(null)
  const [selectedTicketTypeForBoatChange, setSelectedTicketTypeForBoatChange] =
    useState<string>("")

  const [newTicketTripId, setNewTicketTripId] = useState<string>("")
  const [newTicketBoatId, setNewTicketBoatId] = useState<string>("")
  const [newTicketType, setNewTicketType] = useState<string>("")
  const [newTicketQty, setNewTicketQty] = useState<number>(1)

  const { data: newTicketTripBoats } = useQuery({
    queryKey: ["trip-boats", newTicketTripId],
    queryFn: () =>
      TripBoatsService.readTripBoatsByTrip({
        tripId: newTicketTripId,
        limit: 100,
      }),
    enabled: !!newTicketTripId,
  })

  const { data: newTicketPricing } = useQuery({
    queryKey: ["effective-pricing", newTicketTripId, newTicketBoatId],
    queryFn: () =>
      TripBoatsService.readEffectivePricing({
        tripId: newTicketTripId,
        boatId: newTicketBoatId,
      }),
    enabled: !!newTicketTripId && !!newTicketBoatId,
  })

  const addTicketMutation = useMutation({
    mutationFn: (item: {
      trip_id: string
      boat_id: string
      item_type: string
      quantity: number
      price_per_unit: number
    }) =>
      BookingsService.addBookingItem({
        bookingId: booking.id,
        requestBody: {
          trip_id: item.trip_id,
          boat_id: item.boat_id,
          trip_merchandise_id: null,
          item_type: item.item_type,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
          status: "active",
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["booking", booking.confirmation_code],
        updated,
      )
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      showSuccessToast("Ticket added")
      setNewTicketTripId("")
      setNewTicketBoatId("")
      setNewTicketType("")
      setNewTicketQty(1)
      onSuccess()
    },
    onError: handleError,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BookingUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      first_name: booking.first_name,
      last_name: booking.last_name,
      user_email: booking.user_email,
      user_phone: booking.user_phone,
      billing_address: booking.billing_address,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status ?? undefined,
      special_requests: booking.special_requests,
      tip_amount: booking.tip_amount,
      discount_amount: booking.discount_amount,
      tax_amount: booking.tax_amount,
      total_amount: booking.total_amount,
      launch_updates_pref: booking.launch_updates_pref,
      admin_notes: booking.admin_notes ?? undefined,
      item_quantity_updates:
        booking.items?.map((i) => ({ id: i.id, quantity: i.quantity })) ?? [],
    },
  })

  useFieldArray({
    control,
    name: "item_quantity_updates",
  })

  // Sync form to current booking when dialog opens or booking changes (e.g. after duplicate)
  useEffect(() => {
    if (isOpen && booking) {
      reset({
        first_name: booking.first_name,
        last_name: booking.last_name,
        user_email: booking.user_email,
        user_phone: booking.user_phone,
        billing_address: booking.billing_address,
        booking_status: booking.booking_status,
        payment_status: booking.payment_status ?? undefined,
        special_requests: booking.special_requests,
        tip_amount: booking.tip_amount,
        discount_amount: booking.discount_amount,
        tax_amount: booking.tax_amount,
        total_amount: booking.total_amount,
        launch_updates_pref: booking.launch_updates_pref,
        admin_notes: booking.admin_notes ?? undefined,
        item_quantity_updates:
          booking.items?.map((i) => ({ id: i.id, quantity: i.quantity })) ?? [],
      })
    }
  }, [isOpen, booking?.id, reset, booking])

  // Watch form values for auto-calculation
  const watchedDiscountAmount = watch("discount_amount")
  const watchedTipAmount = watch("tip_amount")
  const watchedItemQuantities = watch("item_quantity_updates")

  // Subtotal from current item quantities and prices (so changing quantities updates pricing)
  const effectiveSubtotal =
    booking.items?.reduce((sum, item) => {
      const update = watchedItemQuantities?.find((u) => u.id === item.id)
      const qty = update?.quantity ?? item.quantity
      return sum + qty * item.price_per_unit
    }, 0) ?? booking.subtotal

  // Tax rate derived from current booking (same formula as backend)
  const afterDiscountOriginal = Math.max(
    0,
    booking.subtotal - (booking.discount_amount ?? 0),
  )
  const taxRate =
    afterDiscountOriginal > 0
      ? (booking.tax_amount ?? 0) / afterDiscountOriginal
      : 0

  // Recompute tax and total when subtotal (quantities), discount or tip change
  useEffect(() => {
    const afterDiscount = Math.max(
      0,
      effectiveSubtotal - (watchedDiscountAmount ?? 0),
    )
    const newTax = Math.round(afterDiscount * taxRate)
    const newTotal =
      afterDiscount + newTax + (watchedTipAmount ?? 0)
    setValue("tax_amount", newTax)
    setValue("total_amount", Math.max(0, newTotal))
  }, [
    effectiveSubtotal,
    watchedDiscountAmount,
    watchedTipAmount,
    taxRate,
    setValue,
  ])

  const mutation = useMutation({
    mutationFn: (data: BookingUpdate) =>
      BookingsService.updateBooking({
        bookingId: booking.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Booking updated successfully.")
      reset()
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

  const onSubmit: SubmitHandler<BookingUpdate> = async (data) => {
    const payload = { ...data }
    const paymentStatus = payload.payment_status
    if (
      paymentStatus === undefined ||
      paymentStatus === null ||
      String(paymentStatus) === ""
    ) {
      payload.payment_status = undefined
    }
    // Ensure each update has id (from booking) + quantity (from form); unregistered id can be missing in submit data
    if (booking.items?.length && Array.isArray(payload.item_quantity_updates)) {
      payload.item_quantity_updates = booking.items.map((item, index) => {
        const raw = payload.item_quantity_updates?.[index]?.quantity
        const q = typeof raw === "number" && !Number.isNaN(raw) ? raw : Number(raw)
        const quantity = typeof q === "number" && !Number.isNaN(q) ? Math.max(0, q) : item.quantity
        return { id: item.id, quantity }
      })
    }
    mutation.mutate(payload)
  }

  const tripsForAddTicket = useMemo(() => {
    const trips = tripsData?.data ?? []
    const futureTrips = trips.filter((t) => {
      if (!t.departure_time) return false
      const dep = new Date(t.departure_time)
      return dep >= new Date()
    })
    const firstTicketItem = booking.items?.find((i) => !i.trip_merchandise_id)
    if (!firstTicketItem) return futureTrips
    const firstTrip = trips.find((t) => t.id === firstTicketItem.trip_id)
    const missionId = firstTrip?.mission_id
    if (!missionId) return futureTrips
    return futureTrips.filter((t) => t.mission_id === missionId)
  }, [tripsData?.data, booking.items])

  const boatsForNewTicket =
    (newTicketTripBoats as { boat_id: string; boat?: { name: string } }[])?.map(
      (tb) => ({ boat_id: tb.boat_id, name: tb.boat?.name ?? tb.boat_id }),
    ) ?? []

  const handleAddTicket = () => {
    if (!newTicketTripId || !newTicketBoatId || !newTicketType || newTicketQty < 1)
      return
    const pricing = (newTicketPricing as { ticket_type: string; price: number }[])?.find(
      (p) => p.ticket_type === newTicketType,
    )
    if (!pricing) return

    // If the same ticket (trip + boat + type) already exists, update its quantity instead of creating a duplicate
    const existingIndex = booking.items?.findIndex(
      (i) =>
        !i.trip_merchandise_id &&
        i.trip_id === newTicketTripId &&
        i.boat_id === newTicketBoatId &&
        i.item_type === newTicketType,
    )
    if (existingIndex >= 0) {
      const item = booking.items[existingIndex]
      const currentQty = watchedItemQuantities?.[existingIndex]?.quantity ?? item.quantity
      const newQty = currentQty + newTicketQty
      setValue(`item_quantity_updates.${existingIndex}.quantity`, newQty, {
        shouldDirty: true,
      })
      showSuccessToast(
        `Quantity updated to ${newQty}. Save the booking to apply.`,
      )
      setNewTicketTripId("")
      setNewTicketBoatId("")
      setNewTicketType("")
      setNewTicketQty(1)
      return
    }

    addTicketMutation.mutate({
      trip_id: newTicketTripId,
      boat_id: newTicketBoatId,
      item_type: newTicketType,
      quantity: newTicketQty,
      price_per_unit: pricing.price,
    })
  }

  const getBoatName = (boatId: string) => {
    const boat = boatsData?.data.find((b) => b.id === boatId)
    return boat ? `${boat.name} (Capacity: ${boat.capacity})` : boatId
  }

  return (
    <>
    <DialogRoot
      size={{ base: "lg", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <DialogContent ref={contentRef}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              Edit Booking:{" "}
              <Text as="span" fontFamily="mono" color="dark.text.highlight">
                {booking.confirmation_code}
              </Text>
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update booking information.</Text>
            <VStack gap={4}>
              <BookingCustomerFields
                register={register}
                errors={errors}
              />

              <Field
                label="Payment Intent ID"
                helperText="This field is read-only"
              >
                <Input
                  value={booking.payment_intent_id || "Not set"}
                  readOnly
                  bg="dark.bg.accent"
                  color="text.muted"
                  _focus={{ boxShadow: "none" }}
                  cursor="default"
                />
              </Field>

              {/* Tickets and Merchandise (item_quantity_updates index matches booking.items index) */}
              {booking.items && booking.items.length > 0 && (
                <>
                  <EditBookingTicketsSection
                    booking={booking}
                    boatsByTripId={boatsByTripId}
                    pricingByKey={pricingByKey}
                    getTripNameForId={(tripId) =>
                      getTripName(tripId, tripsData?.data)
                    }
                    getBoatName={getBoatName}
                    control={control}
                    watchedItemQuantities={watchedItemQuantities}
                    updateItemBoatMutation={updateItemBoatMutation}
                    updateItemTypeMutation={updateItemTypeMutation}
                    setPendingBoatChange={setPendingBoatChange}
                    setSelectedTicketTypeForBoatChange={
                      setSelectedTicketTypeForBoatChange
                    }
                    showErrorToast={showErrorToast}
                    newTicketTripId={newTicketTripId}
                    newTicketBoatId={newTicketBoatId}
                    newTicketType={newTicketType}
                    newTicketQty={newTicketQty}
                    tripsForAddTicket={tripsForAddTicket}
                    boatsForNewTicket={boatsForNewTicket}
                    newTicketPricing={newTicketPricing as { ticket_type: string; price: number }[] | undefined}
                    onNewTicketTripIdChange={setNewTicketTripId}
                    onNewTicketBoatIdChange={setNewTicketBoatId}
                    onNewTicketTypeChange={setNewTicketType}
                    onNewTicketQtyChange={setNewTicketQty}
                    onAddTicket={handleAddTicket}
                    addTicketMutation={{
                      isPending: addTicketMutation.isPending,
                    }}
                    getTripNameForAddTicket={(tripId) =>
                      getTripName(tripId, tripsData?.data)
                    }
                  />

                  <Box w="full" mt={4}>
                    <Text fontWeight="semibold" mb={3}>
                      Merchandise
                    </Text>
                    <EditBookingMerchandiseSection
                      items={booking.items}
                      control={control}
                      watchedItemQuantities={watchedItemQuantities}
                      getTripNameForId={(tripId) =>
                        getTripName(tripId, tripsData?.data)
                      }
                    />
                  </Box>
                </>
              )}

              <BookingStatusFields
                mode="edit"
                control={control}
                errors={errors}
              />
              {/* Show refund information (booking-level reason/notes only) */}
              {(booking.refund_reason?.trim() || booking.refund_notes?.trim()) && (
                <Box
                  p={3}
                  bg="bg.panel"
                  borderRadius="md"
                  borderLeft="4px solid"
                  borderColor="status.warning"
                  w="full"
                >
                  <Heading
                    size="lg"
                    mb={2}
                  >
                    Refund Details
                  </Heading>
                  <VStack align="stretch" gap={1}>
                    {booking.refund_reason?.trim() && (
                      <Text fontSize="sm" color="text.secondary">
                        <strong>Reason:</strong> {booking.refund_reason.trim()}
                      </Text>
                    )}
                    {booking.refund_notes?.trim() && (
                      <Text fontSize="sm" color="text.secondary">
                        <strong>Notes:</strong> {booking.refund_notes.trim()}
                      </Text>
                    )}
                  </VStack>
                </Box>
              )}
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
                  placeholder="Special Requests"
                  rows={3}
                />
              </Field>

              <BookingPricingSummary
                mode="edit"
                effectiveSubtotalCents={effectiveSubtotal}
                control={control}
                errors={errors}
              />

              <Field>
                <Controller
                  name="launch_updates_pref"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={(details) =>
                        field.onChange(details.checked)
                      }
                    >
                      Send launch updates
                    </Checkbox>
                  )}
                />
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </DialogActionTrigger>
              <Button
                variant="solid"
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Save
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>

    <BoatChangeTypeDialog
      open={!!pendingBoatChange}
      pendingBoatChange={pendingBoatChange}
      selectedTicketType={selectedTicketTypeForBoatChange}
      onSelectedTicketTypeChange={setSelectedTicketTypeForBoatChange}
      onConfirm={() => {
        if (!pendingBoatChange) return
        updateItemBoatMutation.mutate({
          itemId: pendingBoatChange.itemId,
          boatId: pendingBoatChange.newBoatId,
          itemType: selectedTicketTypeForBoatChange,
        })
        setPendingBoatChange(null)
        setSelectedTicketTypeForBoatChange("")
      }}
      onClose={() => {
        setPendingBoatChange(null)
        setSelectedTicketTypeForBoatChange("")
      }}
    />
    </>
  )
}

export default EditBooking
