import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

const confirmationSearchSchema = z.object({
  confirmationCode: z.string().optional(),
})

export const Route = createFileRoute("/book-confirm")({
  component: BookingConfirmationRedirect,
  validateSearch: (search) => confirmationSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    // Redirect to the new unified endpoint
    if (search.confirmationCode) {
      throw redirect({
        to: "/bookings",
        search: { code: search.confirmationCode },
      })
    }
  },
})

function BookingConfirmationRedirect() {
  // This component should never render due to the redirect in beforeLoad
  return null
}

export default BookingConfirmationRedirect
