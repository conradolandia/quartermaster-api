import {
  Badge,
  Box,
  Button,
  Checkbox,
  EmptyState,
  Flex,
  HStack,
  Icon,
  Link,
  Select,
  Table,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import {
  FiArrowDown,
  FiArrowUp,
  FiSearch,
  FiX,
} from "react-icons/fi"

import {
  MissionsService,
  type TripBoatPublicWithAvailability,
  TripBoatsService,
  type TripWithStats,
  TripsService,
} from "@/client"
import TripActionsMenu from "@/components/Common/TripActionsMenu"
import PendingTrips from "@/components/Pending/PendingTrips"
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
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import type { TripsSearch } from "@/routes/_layout/trips"
import {
  formatCents,
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"

type SortableColumn =
  | "name"
  | "type"
  | "mission_id"
  | "check_in_time"
  | "departure_time"
  | "active"
  | "total_bookings"
  | "total_sales"
type SortDirection = "asc" | "desc"

const TRIP_TYPES = [
  { label: "All Types", value: "" },
  { label: "Launch Viewing", value: "launch_viewing" },
  { label: "Pre-Launch", value: "pre_launch" },
] as const

function getTripsQueryOptions({
  page,
  pageSize,
  missionId,
  tripType,
  includeArchived,
}: {
  page: number
  pageSize: number
  missionId?: string
  tripType?: string
  includeArchived?: boolean
}) {
  return {
    queryFn: () =>
      TripsService.readTrips({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        missionId: missionId || undefined,
        tripType: tripType || undefined,
        includeArchived: includeArchived ?? false,
      }),
    queryKey: ["trips", { page, pageSize, missionId, tripType, includeArchived }],
  }
}

function seatsTakenFromTripBoat(tb: TripBoatPublicWithAvailability): number {
  const u = tb.used_per_ticket_type
  if (u == null || typeof u !== "object") return 0
  return Object.values(u).reduce((a, b) => a + b, 0)
}

interface TripsTableProps {
  search: TripsSearch
  onSearchChange: (updates: Partial<TripsSearch>) => void
}

export default function TripsTable({ search, onSearchChange }: TripsTableProps) {
  useDateFormatPreference()
  const {
    page,
    pageSize,
    sortBy,
    sortDirection,
    missionId,
    tripType,
  } = search
  const { includeArchived, setIncludeArchived } = useIncludeArchived()

  const handleSort = (column: SortableColumn) => {
    const currentSortBy = sortBy || "check_in_time"
    const currentSortDirection = sortDirection || "desc"
    const newDirection: SortDirection =
      currentSortBy === column && currentSortDirection === "desc"
        ? "asc"
        : "desc"
    onSearchChange({ sortBy: column, sortDirection: newDirection })
  }

  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getTripsQueryOptions({
      page,
      pageSize: effectivePageSize,
      missionId,
      tripType,
      includeArchived,
    }),
    placeholderData: (prevData) => prevData,
  })

  const { data: missionsData } = useQuery({
    queryKey: ["missions", "for-trips"],
    queryFn: () =>
      MissionsService.readMissions({
        limit: 100,
        includeArchived: true,
      }),
  })

  const missionsMap = new Map()
  if (missionsData?.data) {
    missionsData.data.forEach((mission) => {
      missionsMap.set(mission.id, mission)
    })
  }

  const tripsData = data?.data ?? []

  const tripBoatsQueries = useQueries({
    queries: tripsData.map((trip) => ({
      queryKey: ["trip-boats", trip.id],
      queryFn: () => TripBoatsService.readTripBoatsByTrip({ tripId: trip.id }),
    })),
  })

  const tripBoatsByTrip: Record<string, TripBoatPublicWithAvailability[]> =
    Object.fromEntries(
      tripsData.map((trip, i) => [
        trip.id,
        Array.isArray(tripBoatsQueries[i]?.data)
          ? tripBoatsQueries[i].data!
          : [],
      ]),
    )

  const setPage = (newPage: number) => onSearchChange({ page: newPage })

  const setPageSize = (newPageSize: number) =>
    onSearchChange({ pageSize: newPageSize, page: 1 })

  const handlePageChange = (details: { page: number }) => setPage(details.page)

  const handleMissionFilter = (selectedMissionId?: string) =>
    onSearchChange({
      missionId: selectedMissionId || undefined,
      page: 1,
    })

  const handleTripTypeFilter = (selectedTripType?: string) =>
    onSearchChange({
      tripType: selectedTripType || undefined,
      page: 1,
    })

  const handleClearFilters = () =>
    onSearchChange({
      missionId: undefined,
      tripType: undefined,
      page: 1,
    })

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    onSearchChange({ page: 1 })
  }

  const missionsForDropdown = (missionsData?.data ?? []).filter(
    (m) => includeArchived || !m.archived,
  )

  const missionsCollection = createListCollection({
    items: [
      { label: "All Missions", value: "" },
      ...missionsForDropdown.map((m) => ({
        label: m.name,
        value: m.id,
      })),
    ],
  })

  const tripTypeCollection = createListCollection({
    items: TRIP_TYPES.map((t) => ({ label: t.label, value: t.value })),
  })

  let tripsToShow = [...tripsData]
  const count = data?.count ?? 0
  const effectiveSortBy = sortBy || "check_in_time"
  const effectiveSortDirection = sortDirection || "desc"

  tripsToShow = tripsToShow.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    let aValue: unknown = a[effectiveSortBy as keyof TripWithStats]
    let bValue: unknown = b[effectiveSortBy as keyof TripWithStats]

    if (
      effectiveSortBy === "check_in_time" ||
      effectiveSortBy === "departure_time"
    ) {
      const aStr = aValue as string | null | undefined
      const bStr = bValue as string | null | undefined
      aValue = aStr ? parseApiDate(aStr).getTime() : 0
      bValue = bStr ? parseApiDate(bStr).getTime() : 0
    }

    if (
      effectiveSortBy === "total_bookings" ||
      effectiveSortBy === "total_sales"
    ) {
      aValue = typeof aValue === "number" ? aValue : 0
      bValue = typeof bValue === "number" ? bValue : 0
    }

    if (effectiveSortBy === "active") {
      aValue = aValue ? 1 : 0
      bValue = bValue ? 1 : 0
    }

    if (effectiveSortBy === "name") {
      aValue = aValue ?? ""
      bValue = bValue ?? ""
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return effectiveSortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    if (typeof aValue === "number" && typeof bValue === "number") {
      return effectiveSortDirection === "asc"
        ? aValue - bValue
        : bValue - aValue
    }
    return 0
  })

  if (isLoading) {
    return <PendingTrips />
  }

  const hasActiveFilters = !!(missionId || tripType)
  const isEmpty = tripsToShow.length === 0

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

  const renderDepartureCell = (
    departureTime: string,
    timezone?: string | null,
  ) => {
    const d = parseApiDate(departureTime)
    if (Number.isNaN(d.getTime())) return <Text fontSize="sm">—</Text>
    const parts = timezone
      ? formatInLocationTimezoneWithAbbr(d, timezone)
      : null
    if (parts) {
      return (
        <Text fontSize="sm">
          {parts.dateTime} {parts.timezoneAbbr}
        </Text>
      )
    }
    return (
      <Text fontSize="sm">
        {d.toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    )
  }

  return (
    <>
      <Flex
        gap={3}
        align={{ base: "stretch", lg: "center" }}
        flexDirection={{ base: "column", lg: "row" }}
        flexWrap="wrap"
        mb={4}
      >
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Mission:
          </Text>
          <Box flex={1} minW={0}>
            <Select.Root
              collection={missionsCollection}
              size="xs"
              borderColor="white"
              value={missionId ? [missionId] : [""]}
              onValueChange={(e) =>
                handleMissionFilter(e.value[0] || undefined)
              }
            >
              <Select.Control width="100%">
                <Select.Trigger>
                  <Select.ValueText placeholder="All Missions" />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content minWidth="300px" maxHeight="60vh" overflowY="auto">
                  {missionsCollection.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Type:
          </Text>
          <Box flex={1} minW={0}>
            <Select.Root
              collection={tripTypeCollection}
              size="xs"
              borderColor="white"
              value={tripType ? [tripType] : [""]}
              onValueChange={(e) =>
                handleTripTypeFilter(e.value[0] || undefined)
              }
            >
              <Select.Control width="100%">
                <Select.Trigger>
                  <Select.ValueText placeholder="All Types" />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content minWidth="180px">
                  {tripTypeCollection.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Box>
        </HStack>
        <HStack gap={3} flexWrap="wrap">
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
          <Button
            size="sm"
            variant="ghost"
            visibility={hasActiveFilters ? "visible" : "hidden"}
            disabled={!hasActiveFilters}
            onClick={handleClearFilters}
          >
            <Flex align="center" gap={1}>
              <FiX />
              Clear filters
            </Flex>
          </Button>
        </HStack>
      </Flex>

      {isEmpty ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <FiSearch />
            </EmptyState.Indicator>
            <VStack textAlign="center" gap={3}>
              <EmptyState.Title>
                {hasActiveFilters
                  ? "No trips match your filters"
                  : "You don't have any trips yet"}
              </EmptyState.Title>
              <EmptyState.Description>
                {hasActiveFilters
                  ? "Try adjusting your filters or clear them to see all trips."
                  : "Add a new trip to get started"}
              </EmptyState.Description>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearFilters}
                >
                  <Flex align="center" gap={1}>
                    <Icon as={FiX} />
                    Clear filters
                  </Flex>
                </Button>
              )}
            </VStack>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          <Box overflowX="auto">
            <Table.Root
              size="sm"
              width="100%"
              minW="max-content"
            >
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader
                    minW="8rem"
                    px={1}
                    pl={3}
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
                    minW="6rem"
                    px={1}
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
                    minW="6rem"
                    px={1}
                    fontWeight="bold"
                    cursor="pointer"
                    onClick={() => handleSort("mission_id")}
                  >
                    <Flex align="center">
                      Mission
                      <SortIcon column="mission_id" />
                    </Flex>
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    minW="8rem"
                    px={1}
                    fontWeight="bold"
                    cursor="pointer"
                    onClick={() => handleSort("departure_time")}
                  >
                    <Flex align="center">
                      Departure
                      <SortIcon column="departure_time" />
                    </Flex>
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    minW="3rem"
                    px={1}
                    fontWeight="bold"
                    cursor="pointer"
                    onClick={() => handleSort("total_bookings")}
                    textAlign="center"
                  >
                    <Flex align="center" justify="center">
                      Seats
                      <SortIcon column="total_bookings" />
                    </Flex>
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    minW="4rem"
                    px={1}
                    fontWeight="bold"
                    cursor="pointer"
                    onClick={() => handleSort("total_sales")}
                  >
                    <Flex align="center">
                      Sales
                      <SortIcon column="total_sales" />
                    </Flex>
                  </Table.ColumnHeader>
                  <Table.ColumnHeader minW="6rem" px={1} fontWeight="bold">
                    Boats
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    minW="4.5rem"
                    px={1}
                    fontWeight="bold"
                    textAlign="center"
                  >
                    Mode
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    minW="4.5rem"
                    px={1}
                    fontWeight="bold"
                    cursor="pointer"
                    onClick={() => handleSort("active")}
                    textAlign="center"
                  >
                    <Flex align="center" justify="center">
                      Status
                      <SortIcon column="active" />
                    </Flex>
                  </Table.ColumnHeader>
                  <Table.ColumnHeader minW="5rem" px={1} fontWeight="bold">
                    Actions
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tripsToShow.map((trip) => {
                  const mission = missionsMap.get(trip.mission_id)
                  const boats = tripBoatsByTrip[trip.id]

                  return (
                    <Table.Row
                      key={trip.id}
                      opacity={
                        isPlaceholderData ? 0.5 : trip.archived ? 0.6 : 1
                      }
                      bg={trip.archived ? "bg.muted" : undefined}
                    >
                      <Table.Cell
                        minW="8rem"
                        px={1}
                        pl={3}
                        verticalAlign="top"
                      >
                        <Link
                          asChild
                          color="dark.accent.primary"
                          _hover={{ textDecoration: "underline" }}
                        >
                          <RouterLink
                            to="/bookings"
                            search={{ tripId: trip.id }}
                          >
                            <Text fontSize="lg" fontWeight="500" as="span">
                              {trip.name || "—"}
                            </Text>
                          </RouterLink>
                        </Link>
                      </Table.Cell>
                      <Table.Cell
                        minW="6rem"
                        px={1}
                        verticalAlign="top"
                      >
                        {trip.type === "launch_viewing"
                          ? "Launch Viewing"
                          : "Pre-Launch"}
                      </Table.Cell>
                      <Table.Cell
                        minW="6rem"
                        px={1}
                        verticalAlign="top"
                      >
                        {mission?.name || "Unknown"}
                      </Table.Cell>
                      <Table.Cell
                        minW="8rem"
                        px={1}
                        verticalAlign="top"
                      >
                        {renderDepartureCell(
                          trip.departure_time,
                          trip.timezone,
                        )}
                      </Table.Cell>
                      <Table.Cell
                        minW="3rem"
                        px={1}
                        verticalAlign="top"
                        textAlign="center"
                      >
                        {boats != null && boats.length > 0
                          ? boats.reduce((sum, tb) => {
                              const used = seatsTakenFromTripBoat(tb)
                              return sum + used
                            }, 0)
                          : 0}
                      </Table.Cell>
                      <Table.Cell
                        minW="4rem"
                        px={1}
                        verticalAlign="top"
                      >
                        ${formatCents(
                          (trip as TripWithStats).total_sales ?? 0,
                        )}
                      </Table.Cell>
                      <Table.Cell minW="6rem" px={1} verticalAlign="top">
                        {boats != null && boats.length > 0 ? (
                          <VStack align="stretch" gap={2}>
                            {boats.map((tb) => {
                              const used = seatsTakenFromTripBoat(tb)
                              const maxCap = tb.max_capacity
                              const remaining = Math.max(0, maxCap - used)
                              const name = tb.boat?.name ?? "Boat"
                              return (
                                <Box key={tb.boat_id}>
                                  <Text fontSize="sm">{name}</Text>
                                  <Text
                                    fontSize="xs"
                                    color="gray.400"
                                    mt={0.5}
                                    lineHeight="1"
                                  >
                                    {used} of {maxCap} seats taken (
                                    {remaining} remaining)
                                  </Text>
                                </Box>
                              )
                            })}
                          </VStack>
                        ) : (
                          <Text fontSize="sm" color="gray.400">
                            No boats assigned to this trip yet.
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell
                        minW="4.5rem"
                        px={1}
                        py={5}
                        verticalAlign="top"
                        textAlign="center"
                      >
                        <Flex
                          justify="center"
                          align="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Badge
                            colorPalette={
                              (trip.booking_mode ?? "private") === "public"
                                ? "blue"
                                : (trip.booking_mode ?? "private") ===
                                    "early_bird"
                                  ? "purple"
                                  : "gray"
                            }
                          >
                            {(trip.booking_mode ?? "private") === "public"
                              ? "Public"
                              : (trip.booking_mode ?? "private") ===
                                  "early_bird"
                                ? "Early Bird"
                                : "Private"}
                          </Badge>
                          <Badge
                            colorPalette={trip.unlisted ? "orange" : "green"}
                            size="sm"
                          >
                            {trip.unlisted ? "Unlisted" : "Listed"}
                          </Badge>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell
                        minW="4.5rem"
                        px={1}
                        py={5}
                        verticalAlign="top"
                        textAlign="center"
                      >
                        <Flex justify="center">
                          <Badge
                            colorPalette={
                              (trip as TripWithStats).archived
                                ? "gray"
                                : trip.active
                                  ? "green"
                                  : "red"
                            }
                          >
                            {(trip as TripWithStats).archived
                              ? "Archived"
                              : trip.active
                                ? "Active"
                                : "Inactive"}
                          </Badge>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell
                        minW="5rem"
                        px={1}
                        py={3}
                        verticalAlign="top"
                      >
                        <Flex justify="center">
                          <TripActionsMenu trip={trip} />
                        </Flex>
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
      )}
    </>
  )
}
