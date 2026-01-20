import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import DiscountCodeManager from "@/components/DiscountCodes/DiscountCodeManager"

export const Route = createFileRoute("/_layout/discount-codes")({
  component: DiscountCodes,
})

function DiscountCodes() {
  return (
    <Container maxW="full" pt={12}>
      <DiscountCodeManager />
    </Container>
  )
}
