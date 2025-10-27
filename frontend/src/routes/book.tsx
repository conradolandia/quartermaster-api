import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import PublicBookingForm from "@/components/Public/PublicBookingForm"

const bookSearchSchema = z.object({
  discount: z.string().optional(),
})

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
  validateSearch: (search) => bookSearchSchema.parse(search),
})

function PublicBookingPage() {
  return <PublicBookingForm />
}

export default PublicBookingPage
