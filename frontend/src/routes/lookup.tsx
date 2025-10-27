import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import BookingLookup from "@/components/Public/BookingLookup"

export const Route = createFileRoute("/lookup")({
  component: Lookup,
})

function Lookup() {
  return (
    <Container maxW="full" py={8}>
      <BookingLookup />
    </Container>
  )
}
