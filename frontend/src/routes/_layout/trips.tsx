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
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { format } from "date-fns"
import { useEffect, useState } from "react"
import { FiArrowDown, FiArrowUp, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import {
  MissionsService,
  TripBoatsService,
  type TripPublic,
  TripsService,
} from "@/client"
import TripActionsMenu from "@/components/Common/TripActionsMenu"
import PendingTrips from "@/components/Pending/PendingTrips"
import AddTrip from "@/components/Trips/AddTrip"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"

// Define sortable columns
type SortableColumn =
  | "type"
  | "mission_id"
  | "check_in_time"
  | "departure_time"
  | "active"
type SortDirection = "asc" | "desc"

const tripsSearchSchema = z.object({
  page: z.number().catch(1),
  sortBy: z
    .enum(["type", "mission_id", "check_in_time", "departure_time", "active"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

const PER_PAGE = 5

function getTripsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      TripsService.readTrips({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["trips", { page }],
  }
}

export const Route = createFileRoute("/_layout/trips")({
  component: Trips,
  validateSearch: (search) => tripsSearchSchema.parse(search),
})

function TripsTable() {
  const { page, sortBy, sortDirection } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Handle sorting
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

  // Query for trips
  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getTripsQueryOptions({ page }),
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

  // Store trip boat counts
  const [tripBoatCounts, setTripBoatCounts] = useState<Record<string, number>>(
    {},
  )

  // Get trips from data
  const tripsData = data?.data ?? []

  // Fetch boat counts for each trip when trips change
  useEffect(() => {
    tripsData.forEach((trip) => {
      TripBoatsService.readTripBoatsByTrip({ tripId: trip.id })
        .then((response: any) => {
          setTripBoatCounts((prev) => ({
            ...prev,
            [trip.id]: response.length,
          }))
        })
        .catch((error) => {
          console.error(`Error fetching boats for trip ${trip.id}:`, error)
        })
    })
  }, [tripsData])

  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page: newPage }),
    })

  // Handler for pagination component
  const handlePageChange = (details: { page: number }) => {
    setPage(details.page)
  }

  // Sort trips if needed
  let tripsToShow = [...tripsData]
  const count = data?.count ?? 0

  if (sortBy && sortDirection) {
    tripsToShow = tripsToShow.sort((a, b) => {
      let aValue: any = a[sortBy as keyof TripPublic]
      let bValue: any = b[sortBy as keyof TripPublic]

      // Handle date sorting
      if (sortBy === "check_in_time" || sortBy === "departure_time") {
        aValue = new Date(aValue as string).getTime()
        bValue = new Date(bValue as string).getTime()
      }

      // Handle boolean sorting
      if (sortBy === "active") {
        aValue = aValue ? 1 : 0
        bValue = bValue ? 1 : 0
      }

      // Handle string sorting
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      // Handle numeric sorting
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

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
    if (sortBy !== column) return null
    return (
      <Icon
        as={sortDirection === "asc" ? FiArrowUp : FiArrowDown}
        ml={2}
        boxSize={4}
      />
    )
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
                onClick={() => handleSort("type")}
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
                display={{ base: "none", md: "table-cell" }}
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
            const boatCount = tripBoatCounts[trip.id] || 0

            return (
              <Table.Row key={trip.id} opacity={isPlaceholderData ? 0.5 : 1}>
                <Table.Cell truncate maxW="sm">
                  {trip.type === "launch_viewing"
                    ? "Launch Viewing"
                    : "Pre-Launch"}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
                  {mission?.name || "Unknown"}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {format(new Date(trip.check_in_time), "MMM d, yyyy h:mm a")}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {format(new Date(trip.departure_time), "MMM d, yyyy h:mm a")}
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {boatCount} boat{boatCount !== 1 ? "s" : ""}
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

      {count > PER_PAGE && (
        <PaginationRoot
          count={count}
          pageSize={PER_PAGE}
          siblingCount={1}
          page={page}
          onPageChange={handlePageChange}
        >
          <Flex justifyContent="flex-end" mt={4}>
            <Flex>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </Flex>
          </Flex>
        </PaginationRoot>
      )}
    </>
  )
}

function Trips() {
  const [isAddTripOpen, setIsAddTripOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Trips Management</Heading>
        <Button onClick={() => setIsAddTripOpen(true)}>
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Trip</span>
          </Flex>
        </Button>
      </Flex>

      <AddTrip
        isOpen={isAddTripOpen}
        onClose={() => setIsAddTripOpen(false)}
        onSuccess={() => setIsAddTripOpen(false)}
      />
      <TripsTable />
    </Container>
  )
}
