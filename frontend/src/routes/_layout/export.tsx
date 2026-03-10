import { Container } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import CSVExportInterface from "@/components/Admin/CSVExportInterface"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/export")({
  component: Export,
})

function Export() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Container maxW="full" pt={12} px={{ base: 4, md: 6 }}>
        <div>Please log in to access the export system.</div>
      </Container>
    )
  }

  return (
    <Container maxW="full" pt={12} px={{ base: 4, md: 6 }}>
      <CSVExportInterface />
    </Container>
  )
}
