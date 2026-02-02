import {
  type ApiError,
  BoatsService,
  type BookingPublic,
  type BookingUpdate,
  BookingsService,
  TripsService,
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
import { NativeSelect } from "@/components/ui/native-select"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"
import { formatDateTimeInLocationTz, handleError, parseApiDate } from "@/utils"
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  DialogActionTrigger,
  HStack,
  Input,
  Table,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
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
  const { showSuccessToast } = useCustomToast()

  // Get trips for display
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  // Find the trip for this booking to check if it's in the past
  const bookingTrip = tripsData?.data?.find((t: any) =>
    booking.items?.some((item: any) => item.trip_id === t.id),
  )
  const tripDeparted =
    bookingTrip && parseApiDate(bookingTrip.departure_time) < new Date()
  // Block editing non-draft bookings for departed trips; drafts (e.g. duplicates) stay editable
  const isPast = tripDeparted && booking.booking_status !== "draft"

  // Get boats for display
  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
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
      user_name: booking.user_name,
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
        user_name: booking.user_name,
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
    mutation.mutate(payload)
  }

  const bookingStatusOptions = [
    { value: "draft", label: "Draft" },
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked In" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ]
  const paymentStatusOptions = [
    { value: "", label: "(none)" },
    { value: "pending_payment", label: "Pending Payment" },
    { value: "paid", label: "Paid" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
    { value: "partially_refunded", label: "Partially Refunded" },
  ]

  const getItemTypeLabel = (itemType: string) => {
    // Map merchandise item types to display names
    const merchandiseMap: Record<string, string> = {
      swag: "Merchandise",
    }
    return merchandiseMap[itemType] || itemType
  }

  const getTripName = (tripId: string) => {
    const trip = tripsData?.data.find((t) => t.id === tripId)
    return trip
      ? `${trip.type} - ${formatDateTimeInLocationTz(
          trip.departure_time,
          trip.timezone,
        )}`
      : tripId
  }

  const getBoatName = (boatId: string) => {
    const boat = boatsData?.data.find((b) => b.id === boatId)
    return boat ? `${boat.name} (Capacity: ${boat.capacity})` : boatId
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
            <DialogTitle>
              Edit Booking:{" "}
              <Text as="span" fontFamily="mono" color="dark.text.highlight">
                {booking.confirmation_code}
              </Text>
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isPast && (
              <Text mb={4} color="orange.500">
                This booking's trip has already departed and cannot be edited.
                Contact a system administrator if you need to make changes to
                past bookings.
              </Text>
            )}
            {!isPast && <Text mb={4}>Update booking information.</Text>}
            <VStack gap={4}>
              <Field
                invalid={!!errors.user_name}
                errorText={errors.user_name?.message}
                label="Customer Name"
              >
                <Input
                  id="user_name"
                  {...register("user_name", {
                    maxLength: {
                      value: 255,
                      message: "Name cannot exceed 255 characters",
                    },
                  })}
                  placeholder="Customer name"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.user_email}
                errorText={errors.user_email?.message}
                label="Customer Email"
              >
                <Input
                  id="user_email"
                  type="email"
                  {...register("user_email", {
                    maxLength: {
                      value: 255,
                      message: "Email cannot exceed 255 characters",
                    },
                  })}
                  placeholder="customer@example.com"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.user_phone}
                errorText={errors.user_phone?.message}
                label="Customer Phone"
              >
                <Input
                  id="user_phone"
                  {...register("user_phone", {
                    maxLength: {
                      value: 40,
                      message: "Phone cannot exceed 40 characters",
                    },
                  })}
                  placeholder="Phone number"
                  disabled={isPast}
                />
              </Field>

              <Field
                invalid={!!errors.billing_address}
                errorText={errors.billing_address?.message}
                label="Billing Address"
              >
                <Textarea
                  id="billing_address"
                  {...register("billing_address", {
                    maxLength: {
                      value: 1000,
                      message: "Billing address cannot exceed 1000 characters",
                    },
                  })}
                  placeholder="Billing address"
                  rows={3}
                  disabled={isPast}
                />
              </Field>

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
                  <Box w="full">
                    <Text fontWeight="semibold" mb={3}>
                      Tickets
                    </Text>
                    {booking.items.some((i) => !i.trip_merchandise_id) ? (
                      <Table.Root size={"xs" as any} variant="outline">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>Trip</Table.ColumnHeader>
                            <Table.ColumnHeader>Boat</Table.ColumnHeader>
                            <Table.ColumnHeader>Type</Table.ColumnHeader>
                            <Table.ColumnHeader>Qty</Table.ColumnHeader>
                            <Table.ColumnHeader>Price</Table.ColumnHeader>
                            <Table.ColumnHeader>Total</Table.ColumnHeader>
                            <Table.ColumnHeader>Status</Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {booking.items.map(
                            (item, index) =>
                              !item.trip_merchandise_id && (
                                <Table.Row key={item.id}>
                                  <Table.Cell>
                                    <Text>{getTripName(item.trip_id)}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>{getBoatName(item.boat_id)}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>
                                      {getItemTypeLabel(item.item_type)}
                                      {item.variant_option
                                        ? ` – ${item.variant_option}`
                                        : ""}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Controller
                                      name={
                                        `item_quantity_updates.${index}.quantity` as const
                                      }
                                      control={control}
                                      rules={{
                                        min: {
                                          value: 1,
                                          message: "Min 1",
                                        },
                                      }}
                                      render={({ field }) => (
                                        <Input
                                          {...field}
                                          type="number"
                                          min={1}
                                          w="16"
                                          disabled={isPast}
                                          value={
                                            field.value === undefined ||
                                            field.value === null
                                              ? 1
                                              : field.value
                                          }
                                          onChange={(e) =>
                                            field.onChange(
                                              Math.max(
                                                1,
                                                Number.parseInt(
                                                  e.target.value,
                                                  10,
                                                ) || 1,
                                              ),
                                            )
                                          }
                                        />
                                      )}
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>
                                      ${formatCents(item.price_per_unit)}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text fontWeight="medium">
                                      $
                                      {formatCents(
                                        (watchedItemQuantities?.[index]
                                          ?.quantity ?? item.quantity) *
                                          item.price_per_unit,
                                      )}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Badge
                                      size="sm"
                                      colorPalette={
                                        item.status === "active"
                                          ? "green"
                                          : item.status === "refunded"
                                            ? "red"
                                            : "gray"
                                      }
                                    >
                                      {item.status}
                                    </Badge>
                                  </Table.Cell>
                                </Table.Row>
                              ),
                          )}
                        </Table.Body>
                      </Table.Root>
                    ) : (
                      <Text color="text.muted" textAlign="center" py={2}>
                        No tickets.
                      </Text>
                    )}
                  </Box>

                  <Box w="full" mt={4}>
                    <Text fontWeight="semibold" mb={3}>
                      Merchandise
                    </Text>
                    {booking.items.some((i) => i.trip_merchandise_id) ? (
                      <Table.Root size={"xs" as any} variant="outline">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>Trip</Table.ColumnHeader>
                            <Table.ColumnHeader>Type</Table.ColumnHeader>
                            <Table.ColumnHeader>Qty</Table.ColumnHeader>
                            <Table.ColumnHeader>Price</Table.ColumnHeader>
                            <Table.ColumnHeader>Total</Table.ColumnHeader>
                            <Table.ColumnHeader>Status</Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {booking.items.map(
                            (item, index) =>
                              item.trip_merchandise_id && (
                                <Table.Row key={item.id}>
                                  <Table.Cell>
                                    <Text>{getTripName(item.trip_id)}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>
                                      {getItemTypeLabel(item.item_type)}
                                      {item.variant_option
                                        ? ` – ${item.variant_option}`
                                        : ""}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Controller
                                      name={
                                        `item_quantity_updates.${index}.quantity` as const
                                      }
                                      control={control}
                                      rules={{
                                        min: {
                                          value: 1,
                                          message: "Min 1",
                                        },
                                      }}
                                      render={({ field }) => (
                                        <Input
                                          {...field}
                                          type="number"
                                          min={1}
                                          w="16"
                                          disabled={isPast}
                                          value={
                                            field.value === undefined ||
                                            field.value === null
                                              ? 1
                                              : field.value
                                          }
                                          onChange={(e) =>
                                            field.onChange(
                                              Math.max(
                                                1,
                                                Number.parseInt(
                                                  e.target.value,
                                                  10,
                                                ) || 1,
                                              ),
                                            )
                                          }
                                        />
                                      )}
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text>
                                      ${formatCents(item.price_per_unit)}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text fontWeight="medium">
                                      $
                                      {formatCents(
                                        (watchedItemQuantities?.[index]
                                          ?.quantity ?? item.quantity) *
                                          item.price_per_unit,
                                      )}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Badge
                                      size="sm"
                                      colorPalette={
                                        item.status === "active"
                                          ? "green"
                                          : item.status === "refunded"
                                            ? "red"
                                            : "gray"
                                      }
                                    >
                                      {item.status}
                                    </Badge>
                                  </Table.Cell>
                                </Table.Row>
                              ),
                          )}
                        </Table.Body>
                      </Table.Root>
                    ) : (
                      <Text color="text.muted" textAlign="center" py={2}>
                        No merchandise.
                      </Text>
                    )}
                  </Box>
                </>
              )}

              {/* Show refund information if any items have refund details */}
                {booking.items?.some(
                  (item) => item.refund_reason || item.refund_notes,
                ) && (
                  <Box
                    mt={3}
                    p={3}
                    bg="status.error"
                    borderRadius="md"
                    opacity={0.1}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color="status.error"
                      mb={2}
                    >
                      Refund Information:
                    </Text>
                    {booking.items
                      .filter((item) => item.refund_reason || item.refund_notes)
                      .map((item) => (
                        <Box key={item.id} mb={2}>
                          <Text fontSize="sm" color="status.error">
                            <strong>
                              {getItemTypeLabel(item.item_type)}
                              {item.variant_option
                                ? ` – ${item.variant_option}`
                                : ""}
                              :
                            </strong>
                            {item.refund_reason &&
                              ` Reason: ${item.refund_reason}`}
                            {item.refund_notes &&
                              ` Notes: ${item.refund_notes}`}
                          </Text>
                        </Box>
                      ))}
                  </Box>
                )}

              <Field
                invalid={!!errors.booking_status}
                errorText={errors.booking_status?.message}
                label="Booking Status"
              >
                <Controller
                  name="booking_status"
                  control={control}
                  render={({ field }) => (
                    <NativeSelect
                      {...field}
                      value={field.value || ""}
                      disabled={isPast}
                    >
                      {bookingStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                />
              </Field>
              <Field
                invalid={!!errors.payment_status}
                errorText={errors.payment_status?.message}
                label="Payment Status"
              >
                <Controller
                  name="payment_status"
                  control={control}
                  render={({ field }) => (
                    <NativeSelect
                      {...field}
                      value={field.value ?? ""}
                      disabled={isPast}
                    >
                      {paymentStatusOptions.map((option) => (
                        <option key={option.value || "none"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                />
              </Field>

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
                  disabled={isPast}
                />
              </Field>

              {/* Financial Fields */}
              <Field
                label="Subtotal"
                helperText="Recalculated from item quantities and prices"
              >
                <Input
                  value={`$${formatCents(effectiveSubtotal)}`}
                  readOnly
                  bg="dark.bg.accent"
                  color="text.muted"
                  _focus={{ boxShadow: "none" }}
                  cursor="default"
                />
              </Field>

              <HStack w="full" gap={3}>
                <Field
                  invalid={!!errors.discount_amount}
                  errorText={errors.discount_amount?.message}
                  label="Discount Amount"
                >
                  <Controller
                    name="discount_amount"
                    control={control}
                    rules={{
                      min: {
                        value: 0,
                        message: "Discount amount must be at least 0",
                      },
                    }}
                    render={({ field }) => (
                      <Input
                        id="discount_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.value != null ? field.value / 100 : ""}
                        onChange={(e) =>
                          field.onChange(
                            Math.round(
                              (Number.parseFloat(e.target.value) || 0) * 100,
                            ),
                          )
                        }
                        placeholder="0.00"
                        disabled={isPast}
                      />
                    )}
                  />
                </Field>

                <Field
                  invalid={!!errors.tax_amount}
                  errorText={errors.tax_amount?.message}
                  label="Tax Amount"
                >
                  <Controller
                    name="tax_amount"
                    control={control}
                    rules={{
                      min: {
                        value: 0,
                        message: "Tax amount must be at least 0",
                      },
                    }}
                    render={({ field }) => (
                      <Input
                        id="tax_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.value != null ? field.value / 100 : ""}
                        onChange={(e) =>
                          field.onChange(
                            Math.round(
                              (Number.parseFloat(e.target.value) || 0) * 100,
                            ),
                          )
                        }
                        placeholder="0.00"
                        disabled={isPast}
                      />
                    )}
                  />
                </Field>
              </HStack>

              <HStack w="full" gap={3}>
                <Field
                  invalid={!!errors.tip_amount}
                  errorText={errors.tip_amount?.message}
                  label="Tip Amount"
                >
                  <Controller
                    name="tip_amount"
                    control={control}
                    rules={{
                      min: {
                        value: 0,
                        message: "Tip amount must be at least 0",
                      },
                    }}
                    render={({ field }) => (
                      <Input
                        id="tip_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.value != null ? field.value / 100 : ""}
                        onChange={(e) =>
                          field.onChange(
                            Math.round(
                              (Number.parseFloat(e.target.value) || 0) * 100,
                            ),
                          )
                        }
                        placeholder="0.00"
                        disabled={isPast}
                      />
                    )}
                  />
                </Field>

                <Field
                  label="Total Amount"
                  helperText="Auto-calculated: (subtotal - discount) + tax + tip"
                >
                  <Controller
                    name="total_amount"
                    control={control}
                    render={({ field }) => (
                      <Input
                        value={`$${formatCents(field.value ?? 0)}`}
                        readOnly
                        bg="dark.bg.accent"
                        color="text.muted"
                        _focus={{ boxShadow: "none" }}
                        cursor="default"
                      />
                    )}
                  />
                </Field>
              </HStack>

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
                      disabled={isPast}
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
                disabled={isSubmitting || isPast}
              >
                Save
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default EditBooking
