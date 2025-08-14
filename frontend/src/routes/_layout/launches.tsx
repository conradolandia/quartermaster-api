import {
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Table,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import { LaunchesService, LocationsService } from "@/client"
import { LaunchActionsMenu } from "@/components/Common/LaunchActionsMenu"
import AddLaunch from "@/components/Launches/AddLaunch"
import PendingLaunches from "@/components/Pending/PendingLaunches"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"

// Define sortable columns
type SortableColumn = "name" | "launch_timestamp" | "summary" | "location_id"
type SortDirection = "asc" | "desc"

const launchesSearchSchema = z.object({
  page: z.number().catch(1),
  sortBy: z
    .enum(["name", "launch_timestamp", "summary", "location_id"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

const PER_PAGE = 5

// Helper function to sort launches
const sortLaunches = (
  launches: any[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return launches

  return [...launches].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    // Handle location sorting by name
    if (sortBy === "location_id") {
      aValue = a.location_id
      bValue = b.location_id
    }

    // Handle date sorting
    if (sortBy === "launch_timestamp") {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    // Handle numeric/date sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })
}

function getLaunchesQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      LaunchesService.readLaunches({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["launches", { page }],
  }
}

// Query to get location data for display
function useLocationsMap() {
  const { data } = useQuery({
    queryKey: ["locations-map"],
    queryFn: () => LocationsService.readLocations({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const locationsMap = new Map()
  if (data?.data) {
    data.data.forEach((location) => {
      locationsMap.set(location.id, location)
    })
  }

  return locationsMap
}

export const Route = createFileRoute("/_layout/launches")({
  component: Launches,
  validateSearch: (search) => launchesSearchSchema.parse(search),
})

function LaunchesTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, sortBy, sortDirection } = Route.useSearch()
  const locationsMap = useLocationsMap()

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"

    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        sortBy: column,
        sortDirection: newDirection,
      }),
    })
  }

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getLaunchesQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (page: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page }),
    })

  // Sort launches
  const launches = sortLaunches(
    data?.data.slice(0, PER_PAGE) ?? [],
    sortBy,
    sortDirection,
  )
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingLaunches />
  }

  if (launches.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>You don't have any launches yet</EmptyState.Title>
            <EmptyState.Description>
              Add a new launch to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  const SortIcon = ({ column }: { column: SortableColumn }) => {
    if (sortBy !== column) return null
    return (
      <Icon
        as={sortDirection === "asc" ? FiArrowUp : FiArrowDown}
        ml={2}
        boxSize={4}
      />
    )
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }} interactive>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("name")}
            >
              <Flex align="center">
                Name
                <SortIcon column="name" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("launch_timestamp")}
            >
              <Flex align="center">
                Launch Date
                <SortIcon column="launch_timestamp" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("summary")}
            >
              <Flex align="center">
                Summary
                <SortIcon column="summary" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("location_id")}
            >
              <Flex align="center">
                Location
                <SortIcon column="location_id" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm" fontWeight="bold">
              Actions
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {launches?.map((launch) => (
            <Table.Row key={launch.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell truncate maxW="sm">
                {launch.name}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {formatDate(launch.launch_timestamp)}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {launch.summary}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {locationsMap.get(launch.location_id)?.name ||
                  launch.location_id}
              </Table.Cell>
              <Table.Cell>
                <LaunchActionsMenu launch={launch} />
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

function Launches() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Launches Management</Heading>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Launch</span>
          </Flex>
        </Button>
      </Flex>
      <AddLaunch
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <LaunchesTable />
    </Container>
  )
}
