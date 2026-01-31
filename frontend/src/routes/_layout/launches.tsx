import {
  Box,
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiFileText, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import { LaunchesService, LocationsService } from "@/client"
import { LaunchActionsMenu } from "@/components/Common/LaunchActionsMenu"
import YamlImportForm from "@/components/Common/YamlImportForm"
import AddLaunch from "@/components/Launches/AddLaunch"
import { YamlImportService } from "@/services/yamlImportService"
import PendingLaunches from "@/components/Pending/PendingLaunches"
import {
  DEFAULT_PAGE_SIZE,
  PageSizeSelect,
} from "@/components/ui/page-size-select"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import {
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"

// Define sortable columns
type SortableColumn = "name" | "launch_timestamp" | "summary" | "location_id"
type SortDirection = "asc" | "desc"

const launchesSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  sortBy: z
    .enum(["name", "launch_timestamp", "summary", "location_id"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

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
      aValue = parseApiDate(aValue).getTime()
      bValue = parseApiDate(bValue).getTime()
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

function getLaunchesQueryOptions({
  page,
  pageSize,
}: {
  page: number
  pageSize: number
}) {
  return {
    queryFn: () =>
      LaunchesService.readLaunches({
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    queryKey: ["launches", { page, pageSize }],
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
  const { page, pageSize, sortBy, sortDirection } = Route.useSearch()
  const locationsMap = useLocationsMap()
  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE

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
    ...getLaunchesQueryOptions({ page, pageSize: effectivePageSize }),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({
        ...prev,
        page: newPage,
      }),
    })

  const setPageSize = (newPageSize: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({
        ...prev,
        pageSize: newPageSize,
        page: 1,
      }),
    })

  // Sort launches
  const launches = sortLaunches(
    data?.data.slice(0, effectivePageSize) ?? [],
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

  const renderLaunchDate = (dateString: string, timezone?: string | null) => {
    const d = parseApiDate(dateString)
    const parts = timezone ? formatInLocationTimezoneWithAbbr(d, timezone) : null
    if (parts) {
      return (
        <>
          {parts.dateTime}
          <Text as="span" display="block" fontSize="xs" opacity={0.7}>
            {parts.timezoneAbbr}
          </Text>
        </>
      )
    }
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <>
      <Box overflowX="auto">
        <Table.Root size={{ base: "sm", md: "md" }}>
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
                display={{ base: "none", md: "table-cell" }}
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
                display={{ base: "none", lg: "table-cell" }}
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
                display={{ base: "none", md: "table-cell" }}
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
              <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
                {renderLaunchDate(launch.launch_timestamp, launch.timezone)}
              </Table.Cell>
              <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                {launch.summary}
              </Table.Cell>
              <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
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
      </Box>
      {count > 0 && (
        <Flex
          justifyContent="space-between"
          align="center"
          flexWrap="wrap"
          gap={4}
          mt={4}
        >
          <PageSizeSelect value={effectivePageSize} onChange={setPageSize} />
          {count > effectivePageSize && (
            <PaginationRoot
              page={page}
              count={count}
              pageSize={effectivePageSize}
              onPageChange={({ page }) => setPage(page)}
            >
              <Flex>
                <PaginationPrevTrigger />
                <PaginationItems />
                <PaginationNextTrigger />
              </Flex>
            </PaginationRoot>
          )}
        </Flex>
      )}
    </>
  )
}

function Launches() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isYamlImportOpen, setIsYamlImportOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Launches Management</Heading>
        <Flex gap={3}>
          <Button
            variant="outline"
            onClick={() => setIsYamlImportOpen(true)}
          >
            <Flex align="center" gap={2}>
              <FiFileText />
              <span>Import from YAML</span>
            </Flex>
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Flex align="center" gap={2}>
              <FiPlus />
              <span>Add Launch</span>
            </Flex>
          </Button>
        </Flex>
      </Flex>
      <AddLaunch
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />

      {/* YAML Import Modal */}
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
              onImport={YamlImportService.importLaunch}
              onSuccess={() => {
                setIsYamlImportOpen(false)
                // Refresh the launches list
                window.location.reload()
              }}
              onCancel={() => setIsYamlImportOpen(false)}
              placeholder="Select a launch YAML file to import"
            />
          </Box>
        </Box>
      )}
      <LaunchesTable />
    </Container>
  )
}
