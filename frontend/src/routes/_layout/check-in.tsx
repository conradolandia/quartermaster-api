import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import CheckInInterface from "@/components/Admin/CheckInInterface"
import useAuth from "@/hooks/useAuth"

const checkInSearchSchema = z.object({
  code: z.string().optional(),
})

export const Route = createFileRoute("/_layout/check-in")({
  component: CheckIn,
  validateSearch: (search) => checkInSearchSchema.parse(search),
})

function CheckIn() {
  const { user } = useAuth()
  const { code } = Route.useSearch()

  if (!user) {
    return (
      <Container maxW="full" pt={12}>
        <div>Please log in to access the check-in system.</div>
      </Container>
    )
  }

  return (
    <Container maxW="full" pt={12}>
      <CheckInInterface initialCode={code} />
    </Container>
  )
}
