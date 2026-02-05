import {
  Box,
  Button,
  HStack,
  Link,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type * as React from "react"
import { useState } from "react"

import { formatCents } from "@/utils"

interface PaymentFormProps {
  clientSecret?: string
  paymentIntentId?: string
  /** Amount in cents */
  amount: number
  onPaymentSuccess: (paymentIntentId: string) => void
  onPaymentError: (error: Error) => void
  loading: boolean
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  clientSecret,
  paymentIntentId,
  amount,
  onPaymentSuccess,
  onPaymentError,
  loading,
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !clientSecret || !paymentIntentId) {
      onPaymentError(new Error("Payment system not ready"))
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setErrorMessage(submitError.message ?? "Validation failed")
        setIsProcessing(false)
        return
      }

      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}${window.location.search}`,
        },
        redirect: "if_required",
      })

      if (error) {
        // Handle case where payment already succeeded (e.g., webhook processed it first)
        // The error object may contain payment_intent with current status
        const paymentIntent = error.payment_intent as
          | { status?: string }
          | undefined
        if (
          error.code === "payment_intent_unexpected_state" &&
          paymentIntent?.status === "succeeded"
        ) {
          // Payment actually succeeded, treat as success
          onPaymentSuccess(paymentIntentId)
        } else {
          setErrorMessage(error.message ?? "Payment failed")
          onPaymentError(new Error(error.message ?? "Payment failed"))
        }
      } else {
        onPaymentSuccess(paymentIntentId)
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Unknown payment error")
      setErrorMessage(err.message)
      onPaymentError(err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!clientSecret || !paymentIntentId) {
    return (
      <Box width="100%">
        <VStack gap={6} align="stretch">
          <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            bg="bg.accent"
            textAlign="center"
          >
            <Text color="gray.600">Setting up payment...</Text>
          </Box>
        </VStack>
      </Box>
    )
  }

  return (
    <Box as="form" onSubmit={handleSubmit} width="100%">
      <VStack gap={6} align="stretch">
        <Box p={4} borderWidth="1px" borderRadius="md" bg="bg.accent">
          <Text mb={4} fontWeight="medium">
            Payment details
          </Text>
          <PaymentElement
            onChange={(event) => setIsComplete(event.complete)}
            options={{
              layout: "tabs",
            }}
          />
        </Box>

        {errorMessage && (
          <Text color="red.500" fontSize="sm">
            {errorMessage}
          </Text>
        )}

        <Separator />

        <HStack justify="space-between">
          <Text fontWeight="bold">Total Amount:</Text>
          <Text fontWeight="bold" fontSize="lg">
            ${formatCents(amount)}
          </Text>
        </HStack>

        <Button
          type="submit"
          colorScheme="blue"
          size="lg"
          loading={isProcessing || loading}
          loadingText="Processing Payment..."
          disabled={
            !stripe ||
            !clientSecret ||
            !paymentIntentId ||
            !isComplete ||
            isProcessing ||
            loading
          }
        >
          Pay ${formatCents(amount)}
        </Button>

        <Box>
          <Text fontSize="sm" textAlign="center">
            Your payment is processed securely through Stripe. We do not store
            your card details.
          </Text>
          <Text fontSize="xs" textAlign="center">
            By completing this payment, you agree to our{" "}
            <Link href="https://www.star-fleet.tours/details">
              terms and conditions
            </Link>
            .
          </Text>
        </Box>
      </VStack>
    </Box>
  )
}

export default PaymentForm
