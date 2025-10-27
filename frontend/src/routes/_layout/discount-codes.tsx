import { Container, Heading } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import DiscountCodeManager from "@/components/DiscountCodes/DiscountCodeManager"

export const Route = createFileRoute("/_layout/discount-codes")({
  component: DiscountCodes,
})

function DiscountCodes() {
  return (
    <Container maxW="full">
      <Heading size="lg" pt={12}>
        Discount Codes Management
      </Heading>

      <DiscountCodeManager />
    </Container>
  )
}
