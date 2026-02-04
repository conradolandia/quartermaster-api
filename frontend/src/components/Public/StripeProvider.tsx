import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import type * as React from "react"

// Get Stripe publishable key from environment variables
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

// Log Stripe key mode so you can verify live vs test in browser console (publishable keys are safe to expose)
if (stripePublishableKey) {
  const mode =
    stripePublishableKey.startsWith("pk_live_") ? "live" : "test"
  console.log(`[Stripe] Using ${mode} publishable key`)
}

// Only initialize Stripe if we have a valid publishable key
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null

/** Dark appearance matching app theme (dark.bg, dark.text, dark.accent). */
const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#fda801",
    colorBackground: "#28343B",
    colorText: "#ffffff",
    colorTextSecondary: "#eeeeee",
    colorDanger: "#f44336",
    borderRadius: "6px",
    fontFamily:
      "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
}

interface StripeProviderProps {
  children: React.ReactNode
  /** Required for Payment Element. Pass client_secret from your PaymentIntent. */
  options?: { clientSecret: string }
}

const StripeProvider: React.FC<StripeProviderProps> = ({
  children,
  options,
}) => {
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

  const elementsOptions = options
    ? { ...options, appearance: stripeAppearance }
    : undefined

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  )
}

export default StripeProvider
