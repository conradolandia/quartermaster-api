import type { BookingPublic } from "@/client"
import { z } from "zod"

/** Sum of ticket quantities (items without trip_merchandise_id) for a booking. */
export function totalTicketQuantity(booking: BookingPublic | undefined): number {
  if (!booking?.items) return 0
  return booking.items
    .filter((item) => !item.trip_merchandise_id)
    .reduce((sum, item) => sum + item.quantity, 0)
}

// Define sortable columns
export type SortableColumn =
  | "confirmation_code"
  | "user_name"
  | "user_email"
  | "user_phone"
  | "booking_status"
  | "total_amount"
  | "created_at"
  | "updated_at"
  | "mission_name"
  | "trip_name"
  | "trip_type"

export type SortDirection = "asc" | "desc"

// Search schema for bookings
export const bookingsSearchSchema = z.object({
  page: z.number().catch(1),
  code: z.string().optional(),
  missionId: z.string().optional(),
  sortBy: z
    .enum([
      "confirmation_code",
      "user_name",
      "user_email",
      "user_phone",
      "booking_status",
      "total_amount",
      "created_at",
      "updated_at",
      "mission_name",
      "trip_name",
      "trip_type",
    ])
    .catch("created_at"),
  sortDirection: z.enum(["asc", "desc"]).catch("desc"),
})

export function getRefundedCents(booking: BookingPublic | undefined): number {
  return booking?.refunded_amount_cents ?? 0
}

export function isPartiallyRefunded(
  booking: BookingPublic | undefined,
): boolean {
  if (!booking) return false
  return (
    booking.payment_status === "partially_refunded" ||
    (booking.payment_status !== "refunded" && getRefundedCents(booking) > 0)
  )
}

// Booking status (lifecycle) colors
export const getBookingStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "green"
    case "checked_in":
      return "blue"
    case "completed":
      return "purple"
    case "cancelled":
      return "red"
    case "draft":
      return "gray"
    default:
      return "gray"
  }
}

/** Human-readable label for booking_status (uppercase for badges). Handles null/undefined and known values. */
export function formatBookingStatusLabel(
  status: string | null | undefined,
): string {
  if (status == null || status === "") return "—"
  switch (status.toLowerCase()) {
    case "draft":
      return "DRAFT"
    case "confirmed":
      return "CONFIRMED"
    case "checked_in":
      return "CHECKED IN"
    case "completed":
      return "COMPLETED"
    case "cancelled":
      return "CANCELLED"
    default:
      return status.replace(/_/g, " ").toUpperCase()
  }
}

/** Human-readable label for payment_status (uppercase for badges). */
export function formatPaymentStatusLabel(
  status: string | null | undefined,
): string {
  if (status == null || status === "") return "—"
  switch (status.toLowerCase()) {
    case "pending_payment":
      return "PENDING PAYMENT"
    case "paid":
      return "PAID"
    case "free":
      return "FREE"
    case "failed":
      return "FAILED"
    case "refunded":
      return "REFUNDED"
    case "partially_refunded":
      return "PARTIALLY REFUNDED"
    default:
      return status.replace(/_/g, " ").toUpperCase()
  }
}

// Payment status colors
export const getPaymentStatusColor = (status: string | null | undefined) => {
  if (!status) return "gray"
  switch (status.toLowerCase()) {
    case "paid":
    case "free":
      return "green"
    case "pending_payment":
      return "yellow"
    case "failed":
      return "red"
    case "refunded":
    case "partially_refunded":
      return "gray"
    default:
      return "gray"
  }
}

/** @deprecated Use getBookingStatusColor or getPaymentStatusColor. Maps legacy single status. */
export const getStatusColor = (status: string) => {
  const paymentOnly = [
    "pending_payment",
    "paid",
    "free",
    "failed",
    "refunded",
    "partially_refunded",
  ]
  if (paymentOnly.includes(status?.toLowerCase())) {
    return getPaymentStatusColor(status)
  }
  return getBookingStatusColor(status)
}

// Helper function to format dates (delegates to utils for international format support)
export { formatDateTimeInLocationTz as formatDate } from "@/utils"
