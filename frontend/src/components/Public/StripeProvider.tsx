import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import type * as React from "react"

// Get Stripe publishable key from environment variables
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

// Debug: Log the key (only in development)
if (import.meta.env.DEV) {
  console.log("Stripe key found:", !!stripePublishableKey)
  if (stripePublishableKey) {
    console.log(
      "Stripe key starts with:",
      `${stripePublishableKey.substring(0, 10)}...`,
    )
  }
}

// Only initialize Stripe if we have a valid publishable key
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null

interface StripeProviderProps {
  children: React.ReactNode
}

const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  // If no Stripe key is configured, show a development message and don't render children
  if (!stripePublishableKey) {
    console.warn(
      "Stripe publishable key not found. Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.",
    )
    return (
      <div
        style={{
          padding: "20px",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffeaa7",
          borderRadius: "4px",
          margin: "20px",
        }}
      >
        <h3>⚠️ Stripe Configuration Missing</h3>
        <p>
          To enable payment processing, add your Stripe publishable key to the
          .env file:
        </p>
        <code>VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...</code>
      </div>
    )
  }

  // If Stripe promise is null, don't render children
  if (!stripePromise) {
    return (
      <div
        style={{
          padding: "20px",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffeaa7",
          borderRadius: "4px",
          margin: "20px",
        }}
      >
        <h3>⚠️ Stripe Initialization Failed</h3>
        <p>Unable to initialize Stripe. Please check your configuration.</p>
      </div>
    )
  }

  return <Elements stripe={stripePromise}>{children}</Elements>
}

export default StripeProvider
