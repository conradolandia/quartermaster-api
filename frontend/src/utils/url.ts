const ADMIN_PREFIX = "admin."

/**
 * Origin for public booking URLs. Strips the admin subdomain when present
 * so copied links point to the public site (e.g. book.star-fleet.tours, not admin.book.star-fleet.tours).
 */
export function getPublicOrigin(): string {
  try {
    const url = new URL(window.location.origin)
    if (url.hostname.startsWith(ADMIN_PREFIX)) {
      url.hostname = url.hostname.slice(ADMIN_PREFIX.length)
      return url.origin
    }
  } catch {
    // fallback if URL parsing fails
  }
  return window.location.origin
}

/**
 * Stripe Dashboard URL for a PaymentIntent. Test vs live path follows
 * VITE_STRIPE_PUBLISHABLE_KEY (pk_live_ → live dashboard, else test).
 */
export function getStripeDashboardPaymentIntentUrl(
  paymentIntentId: string,
): string {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  const isTest = typeof pk === "string" && pk.startsWith("pk_test_")
  const prefix = isTest ? "test/" : ""
  const id = encodeURIComponent(paymentIntentId)
  return `https://dashboard.stripe.com/${prefix}payments/${id}`
}
