import { ApiError, BookingsService, PaymentsService } from "@/client"

export const CONFIRMED_BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "completed",
] as const

export type VerifyPaymentResponse = {
  status?: string
  booking_status?: string
}

export type ConfirmPaidBookingResult =
  | { outcome: "confirmed" }
  | { outcome: "cancelled" }
  | { outcome: "timeout" }
  | { outcome: "verify_failed"; error: unknown }

export const PAYMENT_CONFIRMATION_TIMEOUT_MESSAGE =
  "Payment confirmation is taking longer than expected. Your booking may still confirm—check your email or use Retry below."

export function isBookingConfirmed(status: string | null | undefined): boolean {
  return CONFIRMED_BOOKING_STATUSES.includes(
    status as (typeof CONFIRMED_BOOKING_STATUSES)[number],
  )
}

export function isVerifyPaymentConfirmed(
  response: VerifyPaymentResponse,
): boolean {
  return (
    response.status === "succeeded" && response.booking_status === "confirmed"
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function getBookingStatus(
  confirmationCode: string,
): Promise<string | null | undefined> {
  const booking = await BookingsService.getBookingByConfirmationCode({
    confirmationCode,
  })
  return booking.booking_status
}

async function verifyPaymentWithRetry(
  paymentIntentId: string,
  options: {
    maxAttempts?: number
    timeoutMs?: number
    retryDelayMs?: number
  } = {},
): Promise<VerifyPaymentResponse | null> {
  const { maxAttempts = 3, timeoutMs = 30_000, retryDelayMs = 2_000 } = options

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = (await withTimeout(
        PaymentsService.verifyPayment({ paymentIntentId }),
        timeoutMs,
      )) as VerifyPaymentResponse
      if (isVerifyPaymentConfirmed(result)) {
        return result
      }
      if (
        result.status === "processing" ||
        result.status === "succeeded" ||
        result.status === "requires_capture"
      ) {
        return result
      }
      return result
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error
      }
      await sleep(retryDelayMs * (attempt + 1))
    }
  }
  return null
}

async function pollBookingUntilConfirmed(
  confirmationCode: string,
  options: {
    intervalMs?: number
    maxWaitMs?: number
  } = {},
): Promise<boolean> {
  const { intervalMs = 2_500, maxWaitMs = 90_000 } = options
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const status = await getBookingStatus(confirmationCode)
    if (isBookingConfirmed(status)) {
      return true
    }
    if (status === "cancelled") {
      return false
    }
    await sleep(intervalMs)
  }
  return false
}

/**
 * Confirm a paid booking after Stripe reports success.
 * Polls booking status (source of truth) while nudging the backend via verify-payment.
 */
export async function confirmPaidBooking({
  paymentIntentId,
  confirmationCode,
  maxWaitMs = 90_000,
}: {
  paymentIntentId: string
  confirmationCode: string
  maxWaitMs?: number
}): Promise<ConfirmPaidBookingResult> {
  const initialStatus = await getBookingStatus(confirmationCode)
  if (isBookingConfirmed(initialStatus)) {
    return { outcome: "confirmed" }
  }
  if (initialStatus === "cancelled") {
    return { outcome: "cancelled" }
  }

  let verifyError: unknown = null
  const verifyTask = verifyPaymentWithRetry(paymentIntentId).catch(
    (error: unknown) => {
      verifyError = error
      return null
    },
  )

  const pollConfirmed = await pollBookingUntilConfirmed(confirmationCode, {
    maxWaitMs,
  })
  if (pollConfirmed) {
    await verifyTask
    return { outcome: "confirmed" }
  }

  await verifyTask

  const finalStatus = await getBookingStatus(confirmationCode)
  if (isBookingConfirmed(finalStatus)) {
    return { outcome: "confirmed" }
  }
  if (finalStatus === "cancelled") {
    return { outcome: "cancelled" }
  }
  if (verifyError instanceof ApiError && verifyError.status === 409) {
    return { outcome: "verify_failed", error: verifyError }
  }
  if (verifyError) {
    return { outcome: "verify_failed", error: verifyError }
  }
  return { outcome: "timeout" }
}
