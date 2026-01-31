import {
  Badge,
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
import { useEffect, useState } from "react"
import { FiArrowDown, FiArrowUp, FiFileText, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import {
  MissionsService,
  type TripBoatPublicWithAvailability,
  type TripPublic,
  TripBoatsService,
  TripsService,
} from "@/client"
import TripActionsMenu from "@/components/Common/TripActionsMenu"
import YamlImportForm from "@/components/Common/YamlImportForm"
import PendingTrips from "@/components/Pending/PendingTrips"
import AddTrip from "@/components/Trips/AddTrip"
import { YamlImportService } from "@/services/yamlImportService"
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
type SortableColumn =
  | "name"
  | "type"
  | "mission_id"
  | "check_in_time"
  | "departure_time"
  | "active"
type SortDirection = "asc" | "desc"

const tripsSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  sortBy: z
    .enum(["name", "type", "mission_id", "check_in_time", "departure_time", "active"])
    .catch("check_in_time"),
  sortDirection: z.enum(["asc", "desc"]).catch("desc"),
})

function getTripsQueryOptions({
  page,
  pageSize,
}: {
  page: number
  pageSize: number
}) {
  return {
    queryFn: () =>
      TripsService.readTrips({ skip: (page - 1) * pageSize, limit: pageSize }),
    queryKey: ["trips", { page, pageSize }],
  }
}

export const Route = createFileRoute("/_layout/trips")({
  component: Trips,
  validateSearch: (search) => tripsSearchSchema.parse(search),
})

function TripsTable() {
  const { page, pageSize, sortBy, sortDirection } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Handle sorting
  const handleSort = (column: SortableColumn) => {
    const currentSortBy = sortBy || "check_in_time"
    const currentSortDirection = sortDirection || "desc"
    const newDirection: SortDirection =
      currentSortBy === column && currentSortDirection === "desc" ? "asc" : "desc"

    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        sortBy: column,
        sortDirection: newDirection,
      }),
    })
  }

  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE

  // Query for trips
  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getTripsQueryOptions({ page, pageSize: effectivePageSize }),
    placeholderData: (prevData) => prevData,
  })

  // Get missions for display purposes
  const { data: missionsData } = useQuery({
    queryKey: ["missions-for-trips"],
    queryFn: () => MissionsService.readMissions({ limit: 100 }),
  })

  // Create a map of missions for easy lookup
  const missionsMap = new Map()
  if (missionsData?.data) {
    missionsData.data.forEach((mission) => {
      missionsMap.set(mission.id, mission)
    })
  }

  // Store trip boats with capacity (per boat) per trip
  const [tripBoatsByTrip, setTripBoatsByTrip] = useState<
    Record<string, TripBoatPublicWithAvailability[]>
  >({})

  // Get trips from data
  const tripsData = data?.data ?? []

  // Fetch trip boats (with capacity per boat) for each trip when trips change
  useEffect(() => {
    tripsData.forEach((trip) => {
      TripBoatsService.readTripBoatsByTrip({ tripId: trip.id })
        .then((boats) => {
          setTripBoatsByTrip((prev) => ({
            ...prev,
            [trip.id]: Array.isArray(boats) ? boats : [],
          }))
        })
        .catch((error) => {
          console.error(`Error fetching boats for trip ${trip.id}:`, error)
        })
    })
  }, [tripsData])

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

  // Handler for pagination component
  const handlePageChange = (details: { page: number }) => {
    setPage(details.page)
  }

  // Sort trips - defaults to check_in_time DESC (future first)
  // Backend already sorts by check_in_time DESC, but we apply client-side sorting
  // to allow users to change the sort order
  let tripsToShow = [...tripsData]
  const count = data?.count ?? 0

  // Use defaults if not specified (check_in_time DESC = future at top)
  const effectiveSortBy = sortBy || "check_in_time"
  const effectiveSortDirection = sortDirection || "desc"

  tripsToShow = tripsToShow.sort((a, b) => {
    let aValue: any = a[effectiveSortBy as keyof TripPublic]
    let bValue: any = b[effectiveSortBy as keyof TripPublic]

    // Handle date sorting
      if (effectiveSortBy === "check_in_time" || effectiveSortBy === "departure_time") {
        aValue = parseApiDate(aValue as string).getTime()
        bValue = parseApiDate(bValue as string).getTime()
      }

    // Handle boolean sorting
    if (effectiveSortBy === "active") {
      aValue = aValue ? 1 : 0
      bValue = bValue ? 1 : 0
    }

    // Handle null/undefined for name (treat null as empty string for sorting)
    if (effectiveSortBy === "name") {
      aValue = aValue ?? ""
      bValue = bValue ?? ""
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return effectiveSortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    // Handle numeric sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return effectiveSortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  if (isLoading) {
    return <PendingTrips />
  }

  if (tripsToShow.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>You don't have any trips yet</EmptyState.Title>
            <EmptyState.Description>
              Add a new trip to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  const SortIcon = ({ column }: { column: SortableColumn }) => {
    const currentSortBy = sortBy || "check_in_time"
    const currentSortDirection = sortDirection || "desc"
    if (currentSortBy !== column) return null
    return (
      <Icon
        as={currentSortDirection === "asc" ? FiArrowUp : FiArrowDown}
        ml={2}
        boxSize={4}
      />
    )
  }

  const renderTripDate = (dateString: string, timezone?: string | null) => {
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
                onClick={() => handleSort("type")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  Trip Type
                  <SortIcon column="type" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("mission_id")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Mission
                  <SortIcon column="mission_id" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("check_in_time")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Check-in Time
                  <SortIcon column="check_in_time" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("departure_time")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Departure Time
                  <SortIcon column="departure_time" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Boats
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("active")}
              >
                <Flex align="center">
                  Status
                  <SortIcon column="active" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
        <Table.Body>
          {tripsToShow.map((trip) => {
            const mission = missionsMap.get(trip.mission_id)
            const boats = tripBoatsByTrip[trip.id]

            return (
              <Table.Row key={trip.id} opacity={isPlaceholderData ? 0.5 : 1}>
                <Table.Cell truncate maxW="sm">
                  {trip.name || "—"}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
                  {trip.type === "launch_viewing"
                    ? "Launch Viewing"
                    : "Pre-Launch"}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {mission?.name || "Unknown"}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {renderTripDate(trip.check_in_time, trip.timezone)}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {renderTripDate(trip.departure_time, trip.timezone)}
                </Table.Cell>
                <Table.Cell maxW="sm">
                  {boats != null && boats.length > 0 ? (
                    <VStack align="stretch" gap={1} fontSize="xs" textTransform="uppercase">
                      {boats.map((tb) => {
                        const used = tb.max_capacity - tb.remaining_capacity
                        const name = tb.boat?.name ?? "Boat"
                        return (
                          <Text key={tb.boat_id} truncate title={`${name}: ${used} / ${tb.max_capacity}`}>
                            {name}: {used} / {tb.max_capacity}
                          </Text>
                        )
                      })}
                    </VStack>
                  ) : (
                    "—"
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge colorScheme={trip.active ? "green" : "red"}>
                    {trip.active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <TripActionsMenu trip={trip} />
                </Table.Cell>
              </Table.Row>
            )
          })}
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
          <PageSizeSelect
            value={effectivePageSize}
            onChange={setPageSize}
          />
          {count > effectivePageSize && (
            <PaginationRoot
              page={page}
              count={count}
              pageSize={effectivePageSize}
              siblingCount={1}
              onPageChange={handlePageChange}
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

function Trips() {
  const [isAddTripOpen, setIsAddTripOpen] = useState(false)
  const [isYamlImportOpen, setIsYamlImportOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Trips Management</Heading>
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
              onImport={YamlImportService.importTrip}
              onSuccess={() => {
                setIsYamlImportOpen(false)
                // Refresh the trips list
                window.location.reload()
              }}
              onCancel={() => setIsYamlImportOpen(false)}
              placeholder="Select a trip YAML file to import"
            />
          </Box>
        </Box>
      )}
      <TripsTable />
    </Container>
  )
}
