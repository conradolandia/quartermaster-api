import {
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  Table,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiSearch, FiPlus } from "react-icons/fi"
import { useState } from "react"
import { z } from "zod"

import { JurisdictionsService, LocationsService } from "@/client"
import AddJurisdiction from "@/components/Jurisdictions/AddJurisdiction"
import JurisdictionActionsMenu from "@/components/Common/JurisdictionActionsMenu"
import PendingJurisdictions from "@/components/Pending/PendingJurisdictions"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"

const jurisdictionsSearchSchema = z.object({
  page: z.number().catch(1),
  locationId: z.string().optional(),
})

const PER_PAGE = 5

function getJurisdictionsQueryOptions({ page, locationId }: { page: number, locationId?: string }) {
  return {
    queryFn: () =>
      JurisdictionsService.readJurisdictions({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        locationId,
      }),
    queryKey: ["jurisdictions", { page, locationId }],
  }
}

// Function to create a map of location IDs to location objects
function useLocationsMap() {
  const { data } = useQuery({
    queryKey: ["locations-map"],
    queryFn: () => LocationsService.readLocations({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const locationsMap = new Map()
  if (data?.data) {
    data.data.forEach(location => {
      locationsMap.set(location.id, location)
    })
  }

  return locationsMap
}

export const Route = createFileRoute("/_layout/jurisdictions")({
  component: Jurisdictions,
  validateSearch: (search) => jurisdictionsSearchSchema.parse(search),
})

function JurisdictionsTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, locationId } = Route.useSearch()
  const locationsMap = useLocationsMap()

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getJurisdictionsQueryOptions({ page, locationId }),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (page: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({ ...prev, page }),
    })

  const jurisdictions = data?.data.slice(0, PER_PAGE) ?? []
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingJurisdictions />
  }

  if (jurisdictions.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>
              You don't have any jurisdictions yet
            </EmptyState.Title>
            <EmptyState.Description>
              Add a new jurisdiction to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">State</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Sales Tax Rate</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Location</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {jurisdictions?.map((jurisdiction) => (
            <Table.Row key={jurisdiction.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell truncate maxW="sm">
                {jurisdiction.name}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {jurisdiction.state}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {jurisdiction.sales_tax_rate}%
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {locationsMap.get(jurisdiction.location_id)?.name || jurisdiction.location_id}
              </Table.Cell>
              <Table.Cell>
                <JurisdictionActionsMenu jurisdiction={jurisdiction} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={count}
          pageSize={PER_PAGE}
          onPageChange={({ page }) => setPage(page)}
        >
          <Flex>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}

function Jurisdictions() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Jurisdictions Management</Heading>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          colorScheme="blue"
        >
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Jurisdiction</span>
          </Flex>
        </Button>
      </Flex>
      <AddJurisdiction
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <JurisdictionsTable />
    </Container>
  )
}
