import { useRef, useEffect } from "react";
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
  Badge,
  Table,
} from "@chakra-ui/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { type SubmitHandler, useForm, Controller } from "react-hook-form";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type ApiError,
  type BookingPublic,
  type BookingUpdate,
  BookingsService,
  TripsService,
  BoatsService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils";

interface EditBookingProps {
  booking: BookingPublic;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditBooking = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: EditBookingProps) => {
  const contentRef = useRef(null);
  const queryClient = useQueryClient();
  const { showSuccessToast } = useCustomToast();

  // Get trips for display
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  });

  // Get boats for display
  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
  });

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
      status: booking.status,
      special_requests: booking.special_requests,
      tip_amount: booking.tip_amount,
      discount_amount: booking.discount_amount,
      tax_amount: booking.tax_amount,
      total_amount: booking.total_amount,
      launch_updates_pref: booking.launch_updates_pref,
    },
  });

  // Watch form values for auto-calculation
  const watchedDiscountAmount = watch("discount_amount");
  const watchedTaxAmount = watch("tax_amount");
  const watchedTipAmount = watch("tip_amount");

  // Auto-calculate total based on original subtotal and updated values
  useEffect(() => {
    // Calculate total: subtotal + tax + tip - discount
    const calculatedTotal =
      booking.subtotal +
      (watchedTaxAmount || 0) +
      (watchedTipAmount || 0) -
      (watchedDiscountAmount || 0);

    setValue("total_amount", Math.max(0, calculatedTotal)); // Ensure total is not negative
  }, [
    watchedDiscountAmount,
    watchedTaxAmount,
    watchedTipAmount,
    setValue,
    booking.subtotal,
  ]);

  const mutation = useMutation({
    mutationFn: (data: BookingUpdate) =>
      BookingsService.updateBooking({
        bookingId: booking.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Booking updated successfully.");
      reset();
      onSuccess();
      onClose();
    },
    onError: (err: ApiError) => {
      handleError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  const onSubmit: SubmitHandler<BookingUpdate> = async (data) => {
    mutation.mutate(data);
  };

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "pending_payment", label: "Pending Payment" },
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked In" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" },
  ];

  const getItemTypeLabel = (itemType: string) => {
    const typeMap: Record<string, string> = {
      adult_ticket: "Adult Ticket",
      child_ticket: "Child Ticket",
      infant_ticket: "Infant Ticket",
      swag: "Merchandise",
    };
    return typeMap[itemType] || itemType;
  };

  const getTripName = (tripId: string) => {
    const trip = tripsData?.data.find((t) => t.id === tripId);
    return trip
      ? `${trip.type} - ${new Date(trip.departure_time).toLocaleDateString()}`
      : tripId;
  };

  const getBoatName = (boatId: string) => {
    const boat = boatsData?.data.find((b) => b.id === boatId);
    return boat ? `${boat.name} (Capacity: ${boat.capacity})` : boatId;
  };

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
                <Field
                  label="Confirmation Code"
                  helperText="This field is read-only"
                >
                  <Input
                    value={booking.confirmation_code}
                    readOnly
                    bg="dark.bg.accent"
                    color="text.muted"
                    _focus={{ boxShadow: "none" }}
                    cursor="default"
                  />
                </Field>

                <Field
                  label="Customer Name"
                  helperText="This field is read-only"
                >
                  <Input
                    value={booking.user_name}
                    readOnly
                    bg="dark.bg.accent"
                    color="text.muted"
                    _focus={{ boxShadow: "none" }}
                    cursor="default"
                  />
                </Field>

                <Field
                  label="Customer Email"
                  helperText="This field is read-only"
                >
                  <Input
                    value={booking.user_email}
                    readOnly
                    bg="dark.bg.accent"
                    color="text.muted"
                    _focus={{ boxShadow: "none" }}
                    cursor="default"
                  />
                </Field>

                <Field
                  label="Customer Phone"
                  helperText="This field is read-only"
                >
                  <Input
                    value={booking.user_phone}
                    readOnly
                    bg="dark.bg.accent"
                    color="text.muted"
                    _focus={{ boxShadow: "none" }}
                    cursor="default"
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

                {/* Booking Items Display */}
                <Box w="full">
                  <Text fontWeight="semibold" mb={3}>
                    Booking Items
                  </Text>
                  {booking.items && booking.items.length > 0 ? (
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
                        {booking.items.map((item) => (
                          <Table.Row key={item.id}>
                            <Table.Cell>
                              <Text>{getTripName(item.trip_id)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text>{getBoatName(item.boat_id)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text>{getItemTypeLabel(item.item_type)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text>{item.quantity}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text>${item.price_per_unit.toFixed(2)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontWeight="medium">
                                $
                                {(item.quantity * item.price_per_unit).toFixed(
                                  2
                                )}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge
                                size="sm"
                                colorScheme={
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
                        ))}
                      </Table.Body>
                    </Table.Root>
                  ) : (
                    <Text color="text.muted" textAlign="center" py={4}>
                      No booking items found.
                    </Text>
                  )}

                  {/* Show refund information if any items have refund details */}
                  {booking.items &&
                    booking.items.some(
                      (item) => item.refund_reason || item.refund_notes
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
                          .filter(
                            (item) => item.refund_reason || item.refund_notes
                          )
                          .map((item) => (
                            <Box key={item.id} mb={2}>
                              <Text fontSize="sm" color="status.error">
                                <strong>
                                  {getItemTypeLabel(item.item_type)}:
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
                </Box>

                <Field
                  invalid={!!errors.status}
                  errorText={errors.status?.message}
                  label="Status"
                >
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value || ""}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "6px",
                          border:
                            "1px solid var(--chakra-colors-dark-border-default)",
                          backgroundColor:
                            "var(--chakra-colors-dark-bg-primary)",
                          color: "var(--chakra-colors-dark-text-primary)",
                        }}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
                        message:
                          "Special requests cannot exceed 1000 characters",
                      },
                    })}
                    placeholder="Special Requests"
                    rows={3}
                  />
                </Field>

                {/* Financial Fields */}
                <Field label="Subtotal" helperText="This field is read-only">
                  <Input
                    value={`$${booking.subtotal.toFixed(2)}`}
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
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
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
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
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
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                        />
                      )}
                    />
                  </Field>

                  <Field
                    label="Total Amount"
                    helperText="Auto-calculated: subtotal + tax + tip - discount"
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

                <Field label="Launch Updates Preference">
                  <Controller
                    name="launch_updates_pref"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value || false}
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
  );
};

export default EditBooking;
