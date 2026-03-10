import { Box, Button, Container, Flex, Heading } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiFileText, FiPlus } from "react-icons/fi"
import { z } from "zod"

import YamlImportForm from "@/components/Common/YamlImportForm"
import AddTrip from "@/components/Trips/AddTrip"
import TripsTable from "@/components/Trips/TripsTable"
import { DEFAULT_PAGE_SIZE } from "@/components/ui/page-size-select"
import { YamlImportService } from "@/services/yamlImportService"

const tripsSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  sortBy: z
    .enum([
      "name",
      "type",
      "mission_id",
      "check_in_time",
      "departure_time",
      "active",
      "total_bookings",
      "total_sales",
    ])
    .catch("check_in_time"),
  sortDirection: z.enum(["asc", "desc"]).catch("desc"),
  missionId: z.string().optional(),
  tripType: z.string().optional(),
})

export type TripsSearch = z.infer<typeof tripsSearchSchema>

export const Route = createFileRoute("/_layout/trips")({
  component: Trips,
  validateSearch: (search) => tripsSearchSchema.parse(search),
})

function Trips() {
  const [isAddTripOpen, setIsAddTripOpen] = useState(false)
  const [isYamlImportOpen, setIsYamlImportOpen] = useState(false)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const onSearchChange = (updates: Partial<TripsSearch>) => {
    navigate({
      search: (prev: TripsSearch) => ({ ...prev, ...updates }),
    })
  }

  return (
    <Container maxW="full" px={{ base: 4, md: 6 }}>
      <Flex
        justify="space-between"
        align="center"
        pt={12}
        pb={4}
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="lg">Trips Management</Heading>
        <Flex gap={3} flexWrap="wrap">
          <Button variant="outline" onClick={() => setIsYamlImportOpen(true)}>
            <Flex align="center" gap={2}>
              <FiFileText />
              <span>Import from YAML</span>
            </Flex>
          </Button>
          <Button onClick={() => setIsAddTripOpen(true)}>
            <Flex align="center" gap={2}>
              <FiPlus />
              <span>Add Trip</span>
            </Flex>
          </Button>
        </Flex>
      </Flex>

      <AddTrip
        isOpen={isAddTripOpen}
        onClose={() => setIsAddTripOpen(false)}
        onSuccess={() => setIsAddTripOpen(false)}
      />

      {isYamlImportOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={1000}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={4}
        >
          <Box
            border="1px solid"
            borderColor="dark.border.default"
            borderRadius="lg"
            maxW="md"
            w="full"
            maxH="90vh"
            overflowY="auto"
          >
            <YamlImportForm
              onImport={YamlImportService.importTrip}
              onSuccess={() => {
                setIsYamlImportOpen(false)
                window.location.reload()
              }}
              onCancel={() => setIsYamlImportOpen(false)}
              placeholder="Select a trip YAML file to import"
            />
          </Box>
        </Box>
      )}
      <TripsTable search={search} onSearchChange={onSearchChange} />
    </Container>
  )
}
