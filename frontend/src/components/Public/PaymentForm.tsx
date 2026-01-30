import { Box, Button, HStack, Separator, Text, VStack } from "@chakra-ui/react"
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { StripeCardElementChangeEvent } from "@stripe/stripe-js"
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
  const [cardError, setCardError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardError(event.error ? event.error.message : null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !clientSecret || !paymentIntentId) {
      onPaymentError(new Error("Payment system not ready"))
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      onPaymentError(new Error("Card element not found"))
      return
    }

    setIsProcessing(true)

    try {
      // Confirm the card payment using the provided client secret
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (result.error) {
        throw new Error(result.error.message || "Payment failed")
      }

      if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        console.log("Payment succeeded, calling onPaymentSuccess")
        onPaymentSuccess(paymentIntentId)
      } else {
        throw new Error("Payment was not successful")
      }
    } catch (error) {
      onPaymentError(
        error instanceof Error ? error : new Error("Unknown payment error"),
      )
      setCardError(
        error instanceof Error ? error.message : "Unknown payment error",
      )
    } finally {
      setIsProcessing(false)
    }
  }

  // Show loading state while waiting for payment system
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
            Card Information
          </Text>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#424770",
                  "::placeholder": {
                    color: "#aab7c4",
                  },
                },
                invalid: {
                  color: "#9e2146",
                },
              },
            }}
            onChange={handleCardChange}
          />
        </Box>

        {cardError && (
          <Text color="red.500" fontSize="sm">
            {cardError}
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
            isProcessing ||
            loading ||
            !!cardError
          }
        >
          Pay ${formatCents(amount)}
        </Button>

        <Text fontSize="sm" color="gray.600" textAlign="center">
          Your payment is processed securely through Stripe. We do not store
          your card details.
        </Text>
      </VStack>
    </Box>
  )
}

export default PaymentForm
