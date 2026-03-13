import {
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Link,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import { useState } from "react"
import {
  FiArrowDown,
  FiArrowUp,
  FiFileText,
  FiPlus,
  FiSearch,
} from "react-icons/fi"
import { z } from "zod"

import { LaunchesService, LocationsService } from "@/client"
import { LaunchActionsMenu } from "@/components/Common/LaunchActionsMenu"
import YamlImportForm from "@/components/Common/YamlImportForm"
import AddLaunch from "@/components/Launches/AddLaunch"
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
import { YamlImportService } from "@/services/yamlImportService"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import { formatInLocationTimezoneWithAbbr, parseApiDate } from "@/utils"

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
  if (!sortBy || !sortDirection) {
    return [...launches].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      return 0
    })
  }

  return [...launches].sort((a, b) => {
    // Archived items always sort to the bottom
    if (a.archived !== b.archived) return a.archived ? 1 : -1

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
  includeArchived,
}: {
  page: number
  pageSize: number
  includeArchived?: boolean
}) {
  return {
    queryFn: () =>
      LaunchesService.readLaunches({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        includeArchived: includeArchived ?? false,
      }),
    queryKey: ["launches", { page, pageSize, includeArchived }],
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
  useDateFormatPreference()
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, pageSize, sortBy, sortDirection } = Route.useSearch()
  const { includeArchived, setIncludeArchived } = useIncludeArchived()
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

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        page: 1,
      }),
    })
  }

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getLaunchesQueryOptions({
      page,
      pageSize: effectivePageSize,
      includeArchived,
    }),
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
    const parts = timezone
      ? formatInLocationTimezoneWithAbbr(d, timezone)
      : null
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
      <Flex align="center" gap={3} mb={4} flexWrap="wrap">
        <Checkbox.Root
          checked={includeArchived}
          onCheckedChange={(e) =>
            handleIncludeArchivedChange(e.checked === true)
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize="sm" color="text.secondary">
            Include archived
          </Checkbox.Label>
        </Checkbox.Root>
      </Flex>

      {launches.length === 0 ? (
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
      ) : (
      <>
      <Box overflowX="auto">
        <Table.Root size="md">
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
                w="2xl"
                minW="12rem"
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
              <Table.ColumnHeader w="16" fontWeight="bold" textAlign="center">
                Status
              </Table.ColumnHeader>
              <Table.ColumnHeader w="16" fontWeight="bold" textAlign="center">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {launches?.map((launch) => (
              <Table.Row
                key={launch.id}
                opacity={isPlaceholderData ? 0.5 : launch.archived ? 0.6 : 1}
                bg={launch.archived ? "bg.muted" : undefined}
              >
                <Table.Cell truncate maxW="sm">
                  <Link
                    asChild
                    color="dark.accent.primary"
                    _hover={{ textDecoration: "underline" }}
                  >
                    <RouterLink
                      to="/bookings"
                      search={{ launchId: launch.id }}
                    >
                      <Text fontSize="md" fontWeight="500" as="span">
                        {launch.name}
                      </Text>
                    </RouterLink>
                  </Link>
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {renderLaunchDate(launch.launch_timestamp, launch.timezone)}
                </Table.Cell>
                <Table.Cell maxW="2xl" minW="12rem" whiteSpace="normal">
                  {launch.summary}
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {locationsMap.get(launch.location_id)?.name ||
                    launch.location_id}
                </Table.Cell>
                <Table.Cell w="16" textAlign="center">
                  {launch.archived ? (
                    <Badge size="sm" colorPalette="gray">
                      Archived
                    </Badge>
                  ) : (
                    <Text fontSize="sm" color="text.muted">—</Text>
                  )}
                </Table.Cell>
                <Table.Cell w="16" textAlign="center">
                  <Flex justify="center">
                    <LaunchActionsMenu launch={launch} />
                  </Flex>
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
      )}
    </>
  )
}

function Launches() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isYamlImportOpen, setIsYamlImportOpen] = useState(false)

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
        <Heading size="lg">Launches Management</Heading>
        <Flex gap={3} flexWrap="wrap">
          <Button variant="outline" onClick={() => setIsYamlImportOpen(true)}>
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
