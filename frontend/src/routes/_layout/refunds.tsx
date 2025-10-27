import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import RefundInterface from "@/components/Admin/RefundInterface"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/refunds")({
  component: Refunds,
})

function Refunds() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Container maxW="full">
        <div>Please log in to access the refund system.</div>
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <RefundInterface />
    </Container>
  )
}
