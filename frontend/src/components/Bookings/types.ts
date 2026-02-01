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
  | "status"
  | "total_amount"
  | "created_at"
  | "mission_name"

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
      "status",
      "total_amount",
      "created_at",
      "mission_name",
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
  return booking.status !== "refunded" && getRefundedCents(booking) > 0
}

// Helper function to get status color
export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "confirmed":
      return "green"
    case "pending_payment":
      return "yellow"
    case "cancelled":
      return "red"
    case "refunded":
      return "gray"
    case "checked_in":
      return "blue"
    case "completed":
      return "purple"
    default:
      return "gray"
  }
}

// Helper function to format dates
export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}
