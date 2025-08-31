import { createFileRoute } from "@tanstack/react-router"

import PublicBookingForm from "@/components/Public/PublicBookingForm"

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
})

function PublicBookingPage() {
  return <PublicBookingForm />
}

export default PublicBookingPage
