import { z } from "zod"

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
