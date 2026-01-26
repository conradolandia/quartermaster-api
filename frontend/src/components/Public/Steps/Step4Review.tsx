import { Box, Button, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { type BookingCreate, BookingsService } from "../../../client";

import PaymentForm from "../PaymentForm";
import type { BookingStepData } from "../PublicBookingForm";
import StripeProvider from "../StripeProvider";

interface Step4ReviewProps {
  bookingData: BookingStepData;
  onBack: () => void;
}

const Step4Review = ({ bookingData, onBack }: Step4ReviewProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isBookingSuccessful, setIsBookingSuccessful] = useState(false);
  const [bookingWithPayment, setBookingData] = useState<{
    booking: any;
    paymentData: any;
  } | null>(null);

  // Generate a random confirmation code
  const generateConfirmationCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createBookingMutation = useMutation({
    mutationFn: async (data: { bookingData: BookingStepData }) => {
      const { bookingData } = data;

      const bookingCreate: BookingCreate = {
        user_name: `${bookingData.customerInfo.first_name} ${bookingData.customerInfo.last_name}`,
        user_email: bookingData.customerInfo.email,
        user_phone: bookingData.customerInfo.phone,
        billing_address: bookingData.customerInfo.billing_address || "",
        confirmation_code: generateConfirmationCode(),
        items: bookingData.selectedItems.map((item) => ({
          trip_id: item.trip_id,
          boat_id: bookingData.selectedBoatId,
          item_type: item.item_type,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
          trip_merchandise_id: item.trip_merchandise_id,
        })),
        subtotal: bookingData.subtotal,
        discount_amount: bookingData.discount_amount,
        tax_amount: bookingData.tax_amount,
        tip_amount: bookingData.tip,
        total_amount: bookingData.total,
        special_requests: bookingData.customerInfo.special_requests || "",
        launch_updates_pref: bookingData.customerInfo.launch_updates_pref ?? false,
        discount_code_id: bookingData.discount_code_id,
      };

      // Step 1: Create the booking as draft
      const booking = await BookingsService.createBooking({
        requestBody: bookingCreate,
      });
      console.log("Booking created as draft:", booking.confirmation_code);

      // Step 2: Initialize payment for this booking
      const paymentData = await BookingsService.initializePayment({
        confirmationCode: booking.confirmation_code,
      });
      console.log("Payment initialized:", paymentData);

      return { booking, paymentData };
    },
    onSuccess: ({ booking, paymentData }) => {
      console.log("Booking and payment initialized successfully");
      setBookingData({ booking, paymentData });
    },
    onError: (error) => {
      console.error("Failed to create booking:", error);
    },
  });

  const completeBookingMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      // Payment is already confirmed by Stripe, just wait for webhook processing
      // No need to manually verify since Stripe webhook will handle confirmation
      console.log("Payment successful, waiting for webhook confirmation...");
      return {
        status: "succeeded",
        booking_status: "confirmed",
        paymentIntentId,
      };
    },
    onSuccess: () => {
      console.log("Payment successful, booking will be confirmed via webhook!");
      setIsBookingSuccessful(true);
      // Invalidate bookings cache so the new booking appears in the admin list
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      // Navigate to confirmation page with confirmation code after a brief delay
      setTimeout(() => {
        if (bookingWithPayment?.booking) {
          console.log(
            "Navigating to confirmation page:",
            bookingWithPayment.booking.confirmation_code
          );
          navigate({
            to: "/bookings",
            search: {
              code: bookingWithPayment.booking.confirmation_code,
            },
          });
        }
      }, 3000); // Increased delay to allow webhook processing
    },
    onError: (error) => {
      console.error("Failed to process payment success:", error);
    },
  });

  const handlePaymentSuccess = (paymentIntentId: string) => {
    console.log("Payment successful, verifying payment...", {
      paymentIntentId,
    });
    completeBookingMutation.mutate(paymentIntentId);
  };

  const handlePaymentError = (error: Error) => {
    console.error("Payment failed:", error.message);
  };

  // Initialize booking and payment when component mounts
  useEffect(() => {
    if (!bookingWithPayment && !createBookingMutation.isPending) {
      console.log("Initializing booking and payment...");
      createBookingMutation.mutate({ bookingData });
    }
  }, [bookingData, bookingWithPayment, createBookingMutation]);

  // Show loading state while booking is being initialized
  if (createBookingMutation.isPending) {
    return (
      <VStack gap={6} align="stretch">
        <Box
          p={6}
          bg="blue.50"
          border="1px"
          borderColor="blue.200"
          borderRadius="md"
          textAlign="center"
        >
          <Text color="blue.800" fontWeight="medium">
            Preparing your booking...
          </Text>
          <Text color="blue.700" fontSize="sm" mt={2}>
            Please wait while we set up your payment.
          </Text>
        </Box>
      </VStack>
    );
  }

  // Show error message if booking creation or payment verification failed
  if (createBookingMutation.isError || completeBookingMutation.isError) {
    const errorMessage = createBookingMutation.isError
      ? "There was an error creating your booking. Please try again or contact support if the problem persists."
      : "Payment was successful but we couldn't confirm your booking. Please contact support with your payment details.";

    return (
      <VStack gap={6} align="stretch">
        <Box
          p={4}
          bg="red.50"
          border="1px"
          borderColor="red.200"
          borderRadius="md"
        >
          <Text color="red.800" fontWeight="medium">
            {createBookingMutation.isError
              ? "Booking Creation Failed"
              : "Payment Verification Failed"}
          </Text>
          <Text color="red.700" fontSize="sm" mt={2}>
            {errorMessage}
          </Text>
        </Box>
        <Button onClick={onBack} variant="outline">
          Back to Review
        </Button>
      </VStack>
    );
  }

  // Show success message if booking was successful
  if (isBookingSuccessful) {
    return (
      <VStack gap={6} align="stretch">
        <Box
          p={6}
          bg="green.50"
          border="1px"
          borderColor="green.200"
          borderRadius="md"
          textAlign="center"
        >
          <Heading size="md" color="green.800" mb={2}>
            Booking Successful!
          </Heading>
          <Text color="green.700">
            Your booking has been created successfully. Redirecting you to the
            confirmation page...
          </Text>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="md" mb={4}>
          Review & Complete Booking
        </Heading>
        <Text color="gray.600" mb={6}>
          Please review your booking details before completing payment.
        </Text>
      </Box>

      <HStack align="start" gap={6}>
        {/* Left Column - Booking Details */}
        <VStack gap={4} align="stretch" flex={1}>
          <Box>
            <Heading size="sm" mb={4}>
              Booking Summary
            </Heading>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="medium">Customer:</Text>
                <Text>
                  {bookingData.customerInfo.first_name}{" "}
                  {bookingData.customerInfo.last_name}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Email:</Text>
                <Text>{bookingData.customerInfo.email}</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Phone:</Text>
                <Text>{bookingData.customerInfo.phone}</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Billing Address:</Text>
                <Text>{bookingData.customerInfo.billing_address}</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Items:</Text>
                <Text>{bookingData.selectedItems.length} selected</Text>
              </HStack>
            </VStack>
          </Box>

          <Box>
            <Heading size="sm" mb={4}>
              Selected Items
            </Heading>
            <VStack gap={3} align="stretch">
              {bookingData.selectedItems.map((item, index) => (
                <HStack
                  key={index}
                  justify="space-between"
                  p={3}
                  bg="bg.accent"
                  borderRadius="md"
                >
                  <Box>
                    <Text fontWeight="medium">
                      {item.item_type
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      Quantity: {item.quantity}
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">
                    ${(item.price_per_unit * item.quantity).toFixed(2)}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        </VStack>

        {/* Right Column - Payment */}
        <VStack gap={4} align="stretch">
          <Box>
            <Heading size="sm" mb={4}>
              Payment Summary
            </Heading>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text>Subtotal:</Text>
                <Text>${bookingData.subtotal.toFixed(2)}</Text>
              </HStack>

              {bookingData.discount_amount > 0 && (
                <HStack justify="space-between">
                  <Text>Discount:</Text>
                  <Text color="green.500">
                    -${bookingData.discount_amount.toFixed(2)}
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between">
                <Text>Tax ({bookingData.tax_rate}%):</Text>
                <Text>${bookingData.tax_amount.toFixed(2)}</Text>
              </HStack>

              {bookingData.tip > 0 && (
                <HStack justify="space-between">
                  <Text>Tip:</Text>
                  <Text>${bookingData.tip.toFixed(2)}</Text>
                </HStack>
              )}

              <Box borderTop="1px" borderColor="gray.200" my={2} />

              <HStack justify="space-between">
                <Text fontWeight="bold" fontSize="lg">
                  Total:
                </Text>
                <Text fontWeight="bold" fontSize="lg">
                  ${bookingData.total.toFixed(2)}
                </Text>
              </HStack>
            </VStack>
          </Box>

          <Box p={4} bg="bg.accent" borderRadius="md">
            <Text fontWeight="medium">Payment Processing</Text>
            <Text fontSize="sm">
              Your payment will be processed securely. You'll receive a
              confirmation email with your QR code tickets once payment is
              complete.
            </Text>
          </Box>

          <Box>
            <VStack gap={4} align="stretch">
              <StripeProvider>
                <PaymentForm
                  clientSecret={bookingWithPayment?.paymentData.client_secret}
                  paymentIntentId={
                    bookingWithPayment?.paymentData.payment_intent_id
                  }
                  amount={bookingData.total}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                  loading={completeBookingMutation.isPending}
                />
              </StripeProvider>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                By completing this payment, you agree to our terms and
                conditions.
              </Text>
            </VStack>
          </Box>
        </VStack>
      </HStack>

      {/* Navigation */}
      <HStack justify="space-between" pt={4}>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </HStack>
    </VStack>
  );
};

export default Step4Review;
