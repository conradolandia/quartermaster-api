import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import type { MutableRefObject } from "react"

import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import { formatCents, getApiErrorMessage } from "@/utils"
import type { ApiError } from "@/client"

import PaymentForm from "../PaymentForm"
import type { BookingResult, BookingStepData } from "../bookingTypes"
import StripeProvider from "../StripeProvider"
import { useBookingDraft } from "./useBookingDraft"

interface Step4ReviewProps {
  bookingData: BookingStepData
  onBack: () => void
  bookingResult: BookingResult | null
  onBookingReady: (result: BookingResult) => void
  onResumeBookingLoaded?: (booking: BookingResult["booking"]) => void
  skipHydrateForm?: boolean
  urlCode?: string
  createBookingStartedRef: MutableRefObject<boolean>
  accessCodeDiscountCodeId?: string | null
}

const Step4Review = ({
  bookingData,
  onBack,
  bookingResult,
  onBookingReady,
  onResumeBookingLoaded,
  skipHydrateForm,
  urlCode,
  createBookingStartedRef,
  accessCodeDiscountCodeId,
}: Step4ReviewProps) => {
  const {
    isBookingSuccessful,
    customerInfoInvalid,
    isPending,
    isCreateError,
    isCompleteError,
    createError,
    isCompletePending,
    canRetryVerification,
    handlePaymentSuccess,
    handlePaymentError,
    handleRetryVerification,
  } = useBookingDraft({
    bookingData,
    bookingResult,
    onBookingReady,
    onResumeBookingLoaded,
    skipHydrateForm,
    urlCode,
    createBookingStartedRef,
    accessCodeDiscountCodeId,
  })

  if (customerInfoInvalid && !bookingResult) {
    return (
      <VStack gap={6} align="stretch">
        <Box
          p={4}
          bg="orange.50"
          border="1px"
          borderColor="orange.200"
          borderRadius="md"
        >
          <Heading size="sm" color="orange.800" mb={2}>
            Information incomplete or invalid
          </Heading>
          <Text color="orange.700" fontSize="sm" mb={4}>
            Please go back and complete your contact and billing details before
            continuing.
          </Text>
          <Button variant="outline" onClick={onBack}>
            Back to your information
          </Button>
        </Box>
      </VStack>
    )
  }

  if (isPending && !bookingResult) {
    const isFree = bookingData.total < 50
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
            {isFree
              ? "Confirming your free booking..."
              : "Preparing your booking..."}
          </Text>
          <Text color="blue.700" fontSize="sm" mt={2}>
            {isFree
              ? "Please wait."
              : "Please wait while we set up your payment."}
          </Text>
        </Box>
      </VStack>
    )
  }

  if (isCreateError || isCompleteError) {
    const errorMessage = isCreateError
      ? getApiErrorMessage(createError as ApiError)
      : "Payment was successful but we couldn't confirm your booking. Please contact FleetCommand@Star-Fleet.Tours for assistance."

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
            {isCreateError
              ? "Booking Creation Failed"
              : "Payment Verification Failed"}
          </Text>
          <Text color="red.700" fontSize="sm" mt={2}>
            {errorMessage}
          </Text>
        </Box>
        <HStack gap={2}>
          {canRetryVerification && (
            <Button
              onClick={handleRetryVerification}
              colorScheme="blue"
              loading={isCompletePending}
              loadingText="Verifying..."
            >
              Retry Verification
            </Button>
          )}
          <Button onClick={onBack} variant="outline">
            Back to Review
          </Button>
        </HStack>
      </VStack>
    )
  }

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
    )
  }

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="5xl" fontWeight="200" mb={2}>
          Review & Complete Booking
        </Heading>
        <Text mb={6}>
          Please review your booking details before completing payment.
        </Text>
      </Box>

      <Flex
        direction={{ base: "column", lg: "row" }}
        align="stretch"
        gap={6}
      >
        {/* Left Column - Booking Details */}
        <VStack gap={4} align="stretch" flex={1}>
          <Box>
            <Heading size="2xl" fontWeight="200" mb={4}>
              Booking Summary
            </Heading>
            <Separator mb={3} />
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
            </VStack>
          </Box>

          <Separator />

          <Box>
            <HStack justify="space-between">
              <Heading size="2xl" fontWeight="200" mb={4}>
                Selected Items
              </Heading>
              <Text mb={4} fontSize="2xl" color="whiteAlpha.500">
                {bookingData.selectedItems.length} selected
              </Text>
            </HStack>
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
                      {item.variant_option
                        ? ` – ${item.variant_option}`
                        : ""}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      Quantity: {item.quantity}
                    </Text>
                  </Box>
                  <Text fontWeight="semibold">
                    ${formatCents(item.price_per_unit * item.quantity)}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        </VStack>

        {/* Right Column - Payment */}
        <VStack gap={4} align="stretch">
          <Box>
            <Heading size="2xl" fontWeight="200" mb={4}>
              Payment Summary
            </Heading>
            <Separator mb={3} />
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text>Subtotal:</Text>
                <Text>${formatCents(bookingData.subtotal)}</Text>
              </HStack>
              {bookingData.discount_amount > 0 && (
                <HStack justify="space-between">
                  <Text>Discount:</Text>
                  <Text color="green.500">
                    -${formatCents(bookingData.discount_amount)}
                  </Text>
                </HStack>
              )}
              <HStack justify="space-between">
                <Text>
                  Tax ({Number(bookingData.tax_rate.toFixed(2))}%):
                </Text>
                <Text>${formatCents(bookingData.tax_amount)}</Text>
              </HStack>
              {bookingData.tip > 0 && (
                <HStack justify="space-between">
                  <StarFleetTipLabel showColon />
                  <Text>${formatCents(bookingData.tip)}</Text>
                </HStack>
              )}
              <Separator />
              <HStack justify="space-between">
                <Text fontWeight="bold" fontSize="2xl">
                  Total:
                </Text>
                <Text fontWeight="bold" fontSize="2xl">
                  ${formatCents(bookingData.total)}
                </Text>
              </HStack>
            </VStack>
          </Box>

          <Box p={4} bg="bg.accent" borderRadius="md">
            <Text fontSize="xs" width="100%">
              Your payment will be processed securely. You'll receive a
              confirmation email with your QR code tickets once payment is
              complete.
            </Text>
          </Box>

          <Box>
            {bookingResult && (
              <VStack gap={4} align="stretch">
                <StripeProvider
                  options={{
                    clientSecret: bookingResult.paymentData.client_secret,
                  }}
                >
                  <PaymentForm
                    clientSecret={bookingResult.paymentData.client_secret}
                    paymentIntentId={
                      bookingResult.paymentData.payment_intent_id
                    }
                    amount={bookingData.total}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    loading={isCompletePending}
                  />
                </StripeProvider>
              </VStack>
            )}
          </Box>
        </VStack>
      </Flex>

      {/* Navigation */}
      <Flex justify="flex-start" pt={4}>
        <Button
          variant="outline"
          onClick={onBack}
          size={{ base: "lg", sm: "md" }}
        >
          Back
        </Button>
      </Flex>
    </VStack>
  )
}

export default Step4Review
