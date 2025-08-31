import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import BookingConfirmation from "@/components/Public/BookingConfirmation"

const confirmationSearchSchema = z.object({
  confirmationCode: z.string().optional(),
})

export const Route = createFileRoute("/book-confirm")({
  component: BookingConfirmationPage,
  validateSearch: (search) => confirmationSearchSchema.parse(search),
})

function BookingConfirmationPage() {
  return <BookingConfirmation />
}

export default BookingConfirmationPage
