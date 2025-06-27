import { useRef, useEffect } from "react"
import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
  Portal,
  Textarea,
  HStack,
  Box,
  IconButton,
} from "@chakra-ui/react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { type SubmitHandler, useForm, Controller, useFieldArray } from "react-hook-form"
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { type ApiError, type BookingCreate, BookingsService, TripsService, BoatsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface AddBookingProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const AddBooking = ({ isOpen, onClose, onSuccess }: AddBookingProps) => {
  const contentRef = useRef(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  // Get trips for dropdown (including mission information)
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  // Get boats for dropdown
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
  } = useForm<BookingCreate>({
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
      payment_intent_id: "",
      special_requests: "",
      launch_updates_pref: false,
      items: [],
    },
  })

  // Watch form values for auto-calculation
  const watchedItems = watch("items")
  const watchedDiscountAmount = watch("discount_amount")
  const watchedTaxAmount = watch("tax_amount")
  const watchedTipAmount = watch("tip_amount")

  // Auto-calculate subtotal and total
  useEffect(() => {
    // Calculate subtotal from items
    const calculatedSubtotal = (watchedItems || []).reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.price_per_unit || 0)
    }, 0)

    // Calculate total: subtotal + tax + tip - discount
    const calculatedTotal = calculatedSubtotal +
      (watchedTaxAmount || 0) +
      (watchedTipAmount || 0) -
      (watchedDiscountAmount || 0)

    setValue("subtotal", calculatedSubtotal)
    setValue("total_amount", Math.max(0, calculatedTotal)) // Ensure total is not negative
  }, [watchedItems, watchedDiscountAmount, watchedTaxAmount, watchedTipAmount, setValue])

  // Generate confirmation code
  const generateConfirmationCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase()
  }

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const mutation = useMutation({
    mutationFn: (data: BookingCreate) =>
      BookingsService.createBooking({
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Booking created successfully.")
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

  const onSubmit: SubmitHandler<BookingCreate> = async (data) => {
    // Generate confirmation code before submitting
    const bookingData = {
      ...data,
      confirmation_code: generateConfirmationCode(),
    }
    mutation.mutate(bookingData)
  }

  const addBookingItem = () => {
    append({
      trip_id: "",
      boat_id: "",
      item_type: "adult_ticket",
      quantity: 1,
      price_per_unit: 0,
      status: "active",
      refund_reason: null,
      refund_notes: null,
    })
  }

  const itemTypes = [
    { value: "adult_ticket", label: "Adult Ticket" },
    { value: "child_ticket", label: "Child Ticket" },
    { value: "infant_ticket", label: "Infant Ticket" },
    { value: "swag", label: "Merchandise" },
  ]

  return (
    <DialogRoot
      size={{ base: "lg", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <DialogContent ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Booking</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text mb={4}>Add a new booking by filling out the form below. A confirmation code will be auto-generated.</Text>
              <VStack gap={4}>
                <Field
                  invalid={!!errors.user_name}
                  errorText={errors.user_name?.message}
                  label="User Name"
                  required
                >
                  <Input
                    id="user_name"
                    {...register("user_name", {
                      required: "User name is required",
                      maxLength: { value: 255, message: "User name cannot exceed 255 characters" }
                    })}
                    placeholder="User Name"
                    type="text"
                  />
                </Field>

                <Field
                  invalid={!!errors.user_email}
                  errorText={errors.user_email?.message}
                  label="User Email"
                  required
                >
                  <Input
                    id="user_email"
                    {...register("user_email", {
                      required: "User email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address"
                      },
                      maxLength: { value: 255, message: "User email cannot exceed 255 characters" }
                    })}
                    placeholder="user@example.com"
                    type="email"
                  />
                </Field>

                <Field
                  invalid={!!errors.user_phone}
                  errorText={errors.user_phone?.message}
                  label="User Phone"
                  required
                >
                  <Input
                    id="user_phone"
                    {...register("user_phone", {
                      required: "User phone is required",
                      maxLength: { value: 40, message: "User phone cannot exceed 40 characters" }
                    })}
                    placeholder="User Phone"
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
                      maxLength: { value: 1000, message: "Billing address cannot exceed 1000 characters" }
                    })}
                    placeholder="Billing Address"
                    rows={3}
                  />
                </Field>

                {/* Booking Items Section */}
                <Box w="full">
                  <HStack justify="space-between" mb={3}>
                    <Text fontWeight="semibold">Booking Items</Text>
                    <Button
                      size="sm"
                      onClick={addBookingItem}
                      variant="outline"
                    >
                      <LuPlus /> Add Item
                    </Button>
                  </HStack>

                  {fields.map((field, index) => (
                    <Box key={field.id} p={4} border="1px solid" borderColor="dark.border.default" borderRadius="md" mb={3} bg="dark.bg.secondary">
                      <HStack justify="space-between" mb={3}>
                        <Text fontWeight="medium">Item {index + 1}</Text>
                        <IconButton
                          size="sm"
                          onClick={() => remove(index)}
                          variant="ghost"
                          colorScheme="red"
                          aria-label="Remove item"
                        >
                          <LuTrash2 />
                        </IconButton>
                      </HStack>

                      <VStack gap={3}>
                        <HStack w="full" gap={3}>
                          <Field
                            invalid={!!errors.items?.[index]?.trip_id}
                            errorText={errors.items?.[index]?.trip_id?.message}
                            label="Trip"
                            required
                          >
                            <Controller
                              name={`items.${index}.trip_id`}
                              control={control}
                              rules={{ required: "Trip is required" }}
                              render={({ field }) => (
                                <select
                                  {...field}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--chakra-colors-dark-border-default)",
                                    backgroundColor: "var(--chakra-colors-dark-bg-primary)",
                                    color: "var(--chakra-colors-dark-text-primary)"
                                  }}
                                >
                                  <option value="">Select a trip</option>
                                  {tripsData?.data.map((trip) => (
                                    <option key={trip.id} value={trip.id}>
                                      {trip.type} - {new Date(trip.departure_time).toLocaleDateString()} {trip.departure_time ? `at ${new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                          </Field>

                          <Field
                            invalid={!!errors.items?.[index]?.boat_id}
                            errorText={errors.items?.[index]?.boat_id?.message}
                            label="Boat"
                            required
                          >
                            <Controller
                              name={`items.${index}.boat_id`}
                              control={control}
                              rules={{ required: "Boat is required" }}
                              render={({ field }) => (
                                <select
                                  {...field}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--chakra-colors-dark-border-default)",
                                    backgroundColor: "var(--chakra-colors-dark-bg-primary)",
                                    color: "var(--chakra-colors-dark-text-primary)"
                                  }}
                                >
                                  <option value="">Select a boat</option>
                                  {boatsData?.data.map((boat) => (
                                    <option key={boat.id} value={boat.id}>
                                      {boat.name} (Capacity: {boat.capacity})
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                          </Field>
                        </HStack>

                        <HStack w="full" gap={3}>
                          <Field
                            invalid={!!errors.items?.[index]?.item_type}
                            errorText={errors.items?.[index]?.item_type?.message}
                            label="Item Type"
                            required
                          >
                            <Controller
                              name={`items.${index}.item_type`}
                              control={control}
                              rules={{ required: "Item type is required" }}
                              render={({ field }) => (
                                <select
                                  {...field}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--chakra-colors-dark-border-default)",
                                    backgroundColor: "var(--chakra-colors-dark-bg-primary)",
                                    color: "var(--chakra-colors-dark-text-primary)"
                                  }}
                                >
                                  {itemTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                          </Field>

                          <Field
                            invalid={!!errors.items?.[index]?.quantity}
                            errorText={errors.items?.[index]?.quantity?.message}
                            label="Quantity"
                            required
                          >
                            <Controller
                              name={`items.${index}.quantity`}
                              control={control}
                              rules={{
                                required: "Quantity is required",
                                min: { value: 1, message: "Quantity must be at least 1" }
                              }}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  min="1"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  placeholder="1"
                                />
                              )}
                            />
                          </Field>

                          <Field
                            invalid={!!errors.items?.[index]?.price_per_unit}
                            errorText={errors.items?.[index]?.price_per_unit?.message}
                            label="Price Per Unit"
                            required
                          >
                            <Controller
                              name={`items.${index}.price_per_unit`}
                              control={control}
                              rules={{
                                required: "Price per unit is required",
                                min: { value: 0, message: "Price must be at least 0" }
                              }}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                />
                              )}
                            />
                          </Field>
                        </HStack>
                      </VStack>
                    </Box>
                  ))}

                  {fields.length === 0 && (
                    <Text color="text.muted" textAlign="center" py={4}>
                      No items added. Click "Add Item" to add booking items.
                    </Text>
                  )}
                </Box>

                {/* Financial Fields */}
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
                        min: { value: 0, message: "Discount amount must be at least 0" }
                      }}
                      render={({ field }) => (
                        <Input
                          id="discount_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
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
                        min: { value: 0, message: "Tax amount must be at least 0" }
                      }}
                      render={({ field }) => (
                        <Input
                          id="tax_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      )}
                    />
                  </Field>

                  <Field
                    invalid={!!errors.tip_amount}
                    errorText={errors.tip_amount?.message}
                    label="Tip Amount"
                  >
                    <Controller
                      name="tip_amount"
                      control={control}
                      rules={{
                        min: { value: 0, message: "Tip amount must be at least 0" }
                      }}
                      render={({ field }) => (
                        <Input
                          id="tip_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      )}
                    />
                  </Field>
                </HStack>

                {/* Auto-calculated fields */}
                <HStack w="full" gap={3}>
                  <Field
                    label="Subtotal"
                    helperText="Booking items quantity × price per unit"
                  >
                    <Controller
                      name="subtotal"
                      control={control}
                      render={({ field }) => (
                        <Input
                          value={`$${(field.value || 0).toFixed(2)}`}
                          readOnly
                          bg="dark.bg.accent"
                          color="text.muted"
                          _focus={{ boxShadow: "none" }}
                          cursor="default"
                        />
                      )}
                    />
                  </Field>

                  <Field
                    label="Total Amount"
                    helperText="Subtotal + tax + tip - discount"
                  >
                    <Controller
                      name="total_amount"
                      control={control}
                      render={({ field }) => (
                        <Input
                          value={`$${(field.value || 0).toFixed(2)}`}
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

                {/* Optional Payment Intent ID */}
                <Field
                  invalid={!!errors.payment_intent_id}
                  errorText={errors.payment_intent_id?.message}
                  label="Payment Intent ID (Optional)"
                  helperText="Leave empty for manual bookings. Usually generated by Stripe during payment."
                >
                  <Input
                    id="payment_intent_id"
                    {...register("payment_intent_id", {
                      maxLength: { value: 255, message: "Payment intent ID cannot exceed 255 characters" }
                    })}
                    placeholder="pi_xxx (optional)"
                    type="text"
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
                      maxLength: { value: 1000, message: "Special requests cannot exceed 1000 characters" }
                    })}
                    placeholder="Special Requests"
                    rows={3}
                  />
                </Field>

                <Field label="Launch Updates Preference">
                  <Controller
                    name="launch_updates_pref"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(details) => field.onChange(details.checked)}
                      >
                        Receive launch updates
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
      </Portal>
    </DialogRoot>
  )
}

export default AddBooking
