import type { BookingPublic, TripPublic } from "@/client"
import { formatDateTimeInLocationTz } from "@/utils"
import { z } from "zod"

/** Sum of ticket quantities (items without trip_merchandise_id) for a booking. */
export function totalTicketQuantity(booking: BookingPublic | undefined): number {
  if (!booking?.items) return 0
  return booking.items
    .filter((item) => !item.trip_merchandise_id)
    .reduce((sum, item) => sum + item.quantity, 0)
}

export const DESKTOP_FILTER_MIN_WIDTH = "100px"

// Define sortable columns
export type SortableColumn =
  | "confirmation_code"
  | "first_name"
  | "last_name"
  | "user_email"
  | "user_phone"
  | "booking_status"
  | "total_amount"
  | "created_at"
  | "mission_name"
  | "trip_name"
  | "trip_type"
  | "boat_name"
  | "total_quantity"

export type SortDirection = "asc" | "desc"

// Search schema for bookings
export const bookingsSearchSchema = z.object({
  page: z.number().catch(1),
  code: z.string().optional(),
  missionId: z.string().optional(),
  sortBy: z
    .enum([
      "confirmation_code",
      "first_name",
      "last_name",
      "user_email",
      "user_phone",
      "booking_status",
      "total_amount",
      "created_at",
      "mission_name",
      "trip_name",
      "trip_type",
      "boat_name",
      "total_quantity",
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

// Filter option sets for BookingsTable
export const BOOKING_STATUSES = [
  "draft",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
] as const

export const PAYMENT_STATUSES = [
  "pending_payment",
  "paid",
  "free",
  "failed",
  "refunded",
  "partially_refunded",
] as const

/** Parse comma-separated status list from URL param; return valid subset or full list. */
export function parseStatusList(
  param: string | null,
  all: readonly string[],
): string[] {
  if (!param?.trim()) return [...all]
  const parsed = param.split(",").map((s) => s.trim()).filter(Boolean)
  const valid = parsed.filter((s) => all.includes(s))
  return valid.length > 0 ? valid : [...all]
}

/** Human-readable label for trip type (e.g. launch_viewing -> "Launch Viewing"). */
export function tripTypeToLabel(type: string): string {
  if (type === "launch_viewing") return "Launch Viewing"
  if (type === "pre_launch") return "Pre-Launch"
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Label for trip filter dropdown.
 * With name: show only the name (no time, no type).
 * Without name: show trip type and time, or type only if no time.
 */
export function formatTripFilterLabel(trip: TripPublic): string {
  const name = trip.name?.trim()
  if (name) return name
  const readableType = tripTypeToLabel(trip.type)
  const rawTime = formatDateTimeInLocationTz(
    trip.departure_time,
    trip.timezone,
  )
  const timeWithoutSeconds = rawTime.replace(
    /(\d{2}:\d{2}):\d{2}/,
    "$1",
  )
  if (!timeWithoutSeconds) return readableType
  return `${readableType} (${timeWithoutSeconds})`
}

// Helper function to format dates (delegates to utils for international format support)
export { formatDateTimeInLocationTz as formatDate } from "@/utils"
