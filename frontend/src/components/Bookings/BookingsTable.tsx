import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Select,
  Table,
  Text,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiArrowDown, FiArrowUp, FiCopy, FiX } from "react-icons/fi"

import { BookingsService, MissionsService, TripsService } from "@/client"
import type { TripPublic } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import PendingBookings from "@/components/Pending/PendingBookings"
import {
  DEFAULT_PAGE_SIZE,
  PageSizeSelect,
} from "@/components/ui/page-size-select"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents, formatDateTimeInLocationTz } from "@/utils"
import {
  type SortDirection,
  type SortableColumn,
  getStatusColor,
} from "./types"

interface BookingsTableProps {
  onBookingClick: (confirmationCode: string) => void
}

const BOOKING_STATUSES = [
  "draft",
  "pending_payment",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "refunded",
] as const

export default function BookingsTable({ onBookingClick }: BookingsTableProps) {
  const { showSuccessToast } = useCustomToast()
  const initialSearch = new URLSearchParams(window.location.search)
  const [missionId, setMissionId] = useState<string | undefined>(
    initialSearch.get("missionId") || undefined,
  )
  const [tripId, setTripId] = useState<string | undefined>(
    initialSearch.get("tripId") || undefined,
  )
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    initialSearch.get("status") || undefined,
  )
  const [searchParams, setSearchParams] = useState(initialSearch)

  const copyConfirmationCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(code).then(() => {
      showSuccessToast("Confirmation code copied to clipboard")
    })
  }

  // Parse search params
  const page = Number.parseInt(searchParams.get("page") || "1")
  const pageSizeParam = searchParams.get("pageSize")
  const pageSize = pageSizeParam
    ? Number.parseInt(pageSizeParam, 10)
    : DEFAULT_PAGE_SIZE
  const effectivePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
  const sortBy = (searchParams.get("sortBy") as SortableColumn) || "created_at"
  const sortDirection =
    (searchParams.get("sortDirection") as SortDirection) || "desc"

  // Listen for URL changes
  useEffect(() => {
    const handlePopState = () => {
      setSearchParams(new URLSearchParams(window.location.search))
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Fetch bookings with mission, trip, status filters and sorting
  const {
    data: bookingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "bookings",
      page,
      effectivePageSize,
      missionId,
      tripId,
      statusFilter,
      sortBy,
      sortDirection,
    ],
    queryFn: () =>
      BookingsService.listBookings({
        skip: (page - 1) * effectivePageSize,
        limit: effectivePageSize,
        missionId: missionId || undefined,
        tripId: tripId || undefined,
        status: statusFilter || undefined,
        sortBy: sortBy,
        sortDirection: sortDirection,
      }),
  })

  // Fetch missions for filter dropdown
  const { data: missionsData } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions({ limit: 100 }),
  })

  // Fetch trips for filter dropdown
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 500 }),
  })

  // Fetch all bookings to determine which missions have bookings
  const { data: allBookingsData } = useQuery({
    queryKey: ["all-bookings-for-missions"],
    queryFn: () => BookingsService.listBookings({ limit: 1000 }),
  })

  const bookings = bookingsData?.data || []
  const count = bookingsData?.total || 0
  const missions = missionsData?.data || []
  const trips = tripsData?.data || []

  // Filter missions to only show those with existing bookings
  const missionsWithBookings = missions.filter((mission: any) =>
    allBookingsData?.data?.some(
      (booking: any) => booking.mission_id === mission.id,
    ),
  )

  // Filter trips by selected mission
  const filteredTrips = missionId
    ? (trips as TripPublic[]).filter((t) => t.mission_id === missionId)
    : (trips as TripPublic[])

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"

    const params = new URLSearchParams(window.location.search)
    params.set("sortBy", column)
    params.set("sortDirection", newDirection)
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )

    // Update local state to trigger re-render
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const updateFiltersInUrl = (updates: {
    missionId?: string
    tripId?: string
    status?: string
  }) => {
    const params = new URLSearchParams(window.location.search)
    if (updates.missionId !== undefined) {
      if (updates.missionId) params.set("missionId", updates.missionId)
      else params.delete("missionId")
    }
    if (updates.tripId !== undefined) {
      if (updates.tripId) params.set("tripId", updates.tripId)
      else params.delete("tripId")
    }
    if (updates.status !== undefined) {
      if (updates.status) params.set("status", updates.status)
      else params.delete("status")
    }
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handleMissionFilter = (selectedMissionId?: string) => {
    setMissionId(selectedMissionId)
    setTripId(undefined)
    updateFiltersInUrl({
      missionId: selectedMissionId,
      tripId: undefined,
    })
  }

  const handleTripFilter = (selectedTripId?: string) => {
    setTripId(selectedTripId)
    updateFiltersInUrl({ tripId: selectedTripId })
  }

  const handleStatusFilter = (selectedStatus?: string) => {
    setStatusFilter(selectedStatus)
    updateFiltersInUrl({ status: selectedStatus })
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("page", newPage.toString())
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )

    // Update local state to trigger re-render
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("pageSize", newPageSize.toString())
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )

    setSearchParams(new URLSearchParams(params.toString()))
  }

  if (isLoading) {
    return <PendingBookings />
  }

  if (error) {
    return <Text>Error loading bookings</Text>
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

  // Create mission collection for the dropdown
  const missionsCollection = createListCollection({
    items: [
      { label: "All Missions", value: "" },
      ...missionsWithBookings.map((mission: any) => ({
        label: mission.name,
        value: mission.id,
      })),
    ],
  })

  const tripTypeToLabel = (type: string): string => {
    if (type === "launch_viewing") return "Launch Viewing"
    if (type === "pre_launch") return "Pre-Launch"
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatTripFilterLabel = (trip: TripPublic): string => {
    const readableType = tripTypeToLabel(trip.type)
    const time = formatDateTimeInLocationTz(trip.departure_time, trip.timezone)
    if (trip.name?.trim()) {
      return `${trip.name.trim()} - ${readableType} (${time})`
    }
    return `${readableType} (${time})`
  }

  const tripsCollection = createListCollection({
    items: [
      { label: "All Trips", value: "" },
      ...filteredTrips.map((trip: TripPublic) => ({
        label: formatTripFilterLabel(trip),
        value: trip.id,
      })),
    ],
  })

  const statusCollection = createListCollection({
    items: [
      { label: "All Statuses", value: "" },
      ...BOOKING_STATUSES.map((s) => ({
        label: s.replace(/_/g, " "),
        value: s,
      })),
    ],
  })

  return (
    <>
      <Flex mb={4} gap={3} align="center" flexWrap="wrap">
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Mission:
        </Text>
        <Select.Root
          collection={missionsCollection}
          size="xs"
          width="250px"
          borderColor="white"
          value={missionId ? [missionId] : [""]}
          onValueChange={(e) => handleMissionFilter(e.value[0] || undefined)}
        >
          <Select.Control width="100%">
            <Select.Trigger>
              <Select.ValueText placeholder="All Missions" />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content minWidth="300px">
              {missionsCollection.items.map((item) => (
                <Select.Item key={item.value} item={item}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Trip:
        </Text>
        <Select.Root
          collection={tripsCollection}
          size="xs"
          width="280px"
          borderColor="white"
          value={tripId ? [tripId] : [""]}
          onValueChange={(e) => handleTripFilter(e.value[0] || undefined)}
        >
          <Select.Control width="100%">
            <Select.Trigger>
              <Select.ValueText placeholder="All Trips" />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content minWidth="320px">
              {tripsCollection.items.map((item) => (
                <Select.Item key={item.value} item={item}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Status:
        </Text>
        <Select.Root
          collection={statusCollection}
          size="xs"
          width="160px"
          borderColor="white"
          value={statusFilter ? [statusFilter] : [""]}
          onValueChange={(e) => handleStatusFilter(e.value[0] || undefined)}
        >
          <Select.Control width="100%">
            <Select.Trigger>
              <Select.ValueText placeholder="All Statuses" />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content minWidth="180px">
              {statusCollection.items.map((item) => (
                <Select.Item key={item.value} item={item}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
        {(missionId || tripId || statusFilter) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMissionId(undefined)
              setTripId(undefined)
              setStatusFilter(undefined)
              updateFiltersInUrl({
                missionId: undefined,
                tripId: undefined,
                status: undefined,
              })
            }}
          >
            <Flex align="center" gap={1}>
              <FiX />
              Clear filters
            </Flex>
          </Button>
        )}
      </Flex>

      <Box overflowX="auto">
        <Table.Root size={{ base: "sm", md: "md" }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("confirmation_code")}
              >
                <Flex align="center">
                  Code
                  <SortIcon column="confirmation_code" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_name")}
              >
                <Flex align="center">
                  Name
                  <SortIcon column="user_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_email")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  Email
                  <SortIcon column="user_email" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_phone")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Phone
                  <SortIcon column="user_phone" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("mission_name")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Mission
                  <SortIcon column="mission_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("status")}
              >
                <Flex align="center">
                  Status
                  <SortIcon column="status" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("total_amount")}
              >
                <Flex align="center">
                  Total
                  <SortIcon column="total_amount" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("created_at")}
              >
                <Flex align="center">
                  Created
                  <SortIcon column="created_at" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {bookings.map((booking) => (
              <Table.Row
                key={booking.id}
                cursor="pointer"
                onClick={() => onBookingClick(booking.confirmation_code)}
              >
                <Table.Cell>
                  <Flex align="center" gap={2}>
                    <Text
                      fontFamily="mono"
                      fontWeight="bold"
                      color="accent.default"
                    >
                      {booking.confirmation_code}
                    </Text>
                    <IconButton
                      aria-label="Copy confirmation code"
                      size="2xs"
                      variant="ghost"
                      onClick={(e) =>
                        copyConfirmationCode(e, booking.confirmation_code)
                      }
                      title="Copy to clipboard"
                    >
                      <Icon as={FiCopy} boxSize={4} />
                    </IconButton>
                  </Flex>
                </Table.Cell>
                <Table.Cell>{booking.user_name}</Table.Cell>
                <Table.Cell display={{ base: "none", md: "table-cell" }}>
                  {booking.user_email}
                </Table.Cell>
                <Table.Cell display={{ base: "none", lg: "table-cell" }}>
                  {booking.user_phone}
                </Table.Cell>
                <Table.Cell display={{ base: "none", lg: "table-cell" }}>
                  {booking.mission_name || "N/A"}
                </Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={getStatusColor(booking.status || "")}>
                    {booking.status?.replace("_", " ").toUpperCase() ||
                      "UNKNOWN"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text fontWeight="bold">
                    ${formatCents(booking.total_amount)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {new Date(booking.created_at).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Table.Cell>
                <Table.Cell onClick={(e) => e.stopPropagation()}>
                  <BookingActionsMenu booking={booking} />
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
          <PageSizeSelect
            value={effectivePageSize}
            onChange={handlePageSizeChange}
          />
          {count > effectivePageSize && (
            <PaginationRoot
              page={page}
              count={count}
              pageSize={effectivePageSize}
              onPageChange={(p) => handlePageChange(p.page)}
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
