import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import CheckInInterface from "@/components/Admin/CheckInInterface"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/check-in")({
  component: CheckIn,
})

function CheckIn() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Container maxW="full">
        <div>Please log in to access the check-in system.</div>
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <CheckInInterface />
    </Container>
  )
}
