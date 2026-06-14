import { Container } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import CheckInInterface from "@/components/Admin/CheckInInterface"
import useAuth from "@/hooks/useAuth"

const checkInSearchSchema = z.object({
  code: z.string().optional(),
  check_in: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
})

export const Route = createFileRoute("/_layout/check-in")({
  component: CheckIn,
  validateSearch: (search) => checkInSearchSchema.parse(search),
})

function CheckIn() {
  const { user } = useAuth()
  const { code, check_in: autoCheckIn } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  if (!user) {
    return (
      <Container maxW="full" pt={12} px={{ base: 4, md: 6 }}>
        <div>Please log in to access the check-in system.</div>
      </Container>
    )
  }

  return (
    <Container maxW="full" pt={12} px={{ base: 4, md: 6 }}>
      <CheckInInterface
        initialCode={code}
        autoCheckIn={autoCheckIn === true}
        onAutoCheckInComplete={() => {
          if (!code) return
          navigate({
            search: { code },
            replace: true,
          })
        }}
      />
    </Container>
  )
}
