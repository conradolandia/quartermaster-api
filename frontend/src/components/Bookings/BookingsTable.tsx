import {
  Badge,
  Box,
  HStack,
  Button,
  Flex,
  Icon,
  IconButton,
  Input,
  Select,
  Table,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FiArrowDown, FiArrowUp, FiCopy, FiSearch, FiX } from "react-icons/fi"

import {
  BoatsService,
  BookingsService,
  MissionsService,
  TripsService,
} from "@/client"
import type { TripPublic } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import PendingBookings from "@/components/Pending/PendingBookings"
import { InputGroup } from "@/components/ui/input-group"
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
import {
  formatCents,
  formatDateTimeInLocationTz,
  parseApiDate,
} from "@/utils"
import {
  type SortDirection,
  type SortableColumn,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  getBookingStatusColor,
  getPaymentStatusColor,
  getRefundedCents,
  isPartiallyRefunded,
  totalTicketQuantity,
} from "./types"

interface BookingsTableProps {
  onBookingClick: (confirmationCode: string) => void
}

const BOOKING_STATUSES = [
  "draft",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
] as const

const PAYMENT_STATUSES = [
  "pending_payment",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
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
  const [boatId, setBoatId] = useState<string | undefined>(
    initialSearch.get("boatId") || undefined,
  )
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    string | undefined
  >(initialSearch.get("bookingStatus") || undefined)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    string | undefined
  >(initialSearch.get("paymentStatus") || undefined)
  const [searchQuery, setSearchQuery] = useState<string>(
    initialSearch.get("search") || "",
  )
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    initialSearch.get("search") || "",
  )
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // Debounce search: update URL and API trigger after user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = searchQuery.trim()
      setDebouncedSearchQuery(trimmed)
      const params = new URLSearchParams(window.location.search)
      if (trimmed) params.set("search", trimmed)
      else params.delete("search")
      params.set("page", "1")
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`,
      )
      setSearchParams(new URLSearchParams(params.toString()))
    }, 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

  // Listen for URL changes (e.g. browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setSearchParams(params)
      const search = params.get("search") || ""
      setSearchQuery(search)
      setDebouncedSearchQuery(search)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Fetch bookings with mission, trip, boat, status, search filters and sorting
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
      boatId,
      bookingStatusFilter,
      paymentStatusFilter,
      debouncedSearchQuery || null,
      sortBy,
      sortDirection,
    ],
    queryFn: () =>
      BookingsService.listBookings({
        skip: (page - 1) * effectivePageSize,
        limit: effectivePageSize,
        missionId: missionId || undefined,
        tripId: tripId || undefined,
        boatId: boatId || undefined,
        bookingStatus: bookingStatusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        search: debouncedSearchQuery || undefined,
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

  // Fetch boats for filter dropdown
  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 200 }),
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
  const boats = boatsData?.data || []

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
    boatId?: string
    bookingStatus?: string
    paymentStatus?: string
    search?: string
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
    if (updates.boatId !== undefined) {
      if (updates.boatId) params.set("boatId", updates.boatId)
      else params.delete("boatId")
    }
    if (updates.bookingStatus !== undefined) {
      if (updates.bookingStatus) params.set("bookingStatus", updates.bookingStatus)
      else params.delete("bookingStatus")
    }
    if (updates.paymentStatus !== undefined) {
      if (updates.paymentStatus) params.set("paymentStatus", updates.paymentStatus)
      else params.delete("paymentStatus")
    }
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search)
      else params.delete("search")
    }
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
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
    setBoatId(undefined)
    updateFiltersInUrl({ tripId: selectedTripId, boatId: undefined })
  }

  const handleBoatFilter = (selectedBoatId?: string) => {
    setBoatId(selectedBoatId)
    updateFiltersInUrl({ boatId: selectedBoatId })
  }

  const handleBookingStatusFilter = (selected?: string) => {
    setBookingStatusFilter(selected)
    updateFiltersInUrl({ bookingStatus: selected })
  }

  const handlePaymentStatusFilter = (selected?: string) => {
    setPaymentStatusFilter(selected)
    updateFiltersInUrl({ paymentStatus: selected })
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

  const boatsCollection = createListCollection({
    items: [
      { label: "All Boats", value: "" },
      ...boats.map((boat: { id: string; name: string }) => ({
        label: boat.name,
        value: boat.id,
      })),
    ],
  })

  const bookingStatusCollection = createListCollection({
    items: [
      { label: "All booking statuses", value: "" },
      ...BOOKING_STATUSES.map((s) => ({
        label: s.replace(/_/g, " "),
        value: s,
      })),
    ],
  })

  const paymentStatusCollection = createListCollection({
    items: [
      { label: "All payment statuses", value: "" },
      ...PAYMENT_STATUSES.map((s) => ({
        label: s.replace(/_/g, " "),
        value: s,
      })),
    ],
  })

  const filterSelectWidth = "160px"

  return (
    <>
      <Flex gap={3} align="center" flexWrap="wrap" justify="space-between" mb={4}>
        <InputGroup maxWidth="320px" startElement={<Icon as={FiSearch} color="text.muted" boxSize={4} />}>
          <Input
            size="xs"
            placeholder="Search code, name, email, phone"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            borderColor="white"
          />
        </InputGroup>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Mission:
          </Text>
          <Select.Root
            collection={missionsCollection}
            size="xs"
            width={filterSelectWidth}
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
        </HStack>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Trip:
          </Text>
          <Select.Root
            collection={tripsCollection}
            size="xs"
            width={filterSelectWidth}
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
        </HStack>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Boat:
          </Text>
          <Select.Root
            collection={boatsCollection}
            size="xs"
            width={filterSelectWidth}
            borderColor="white"
            value={boatId ? [boatId] : [""]}
            onValueChange={(e) => handleBoatFilter(e.value[0] || undefined)}
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All Boats" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="220px">
                {boatsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </HStack>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Booking:
          </Text>
          <Select.Root
            collection={bookingStatusCollection}
            size="xs"
            width={filterSelectWidth}
            borderColor="white"
            value={bookingStatusFilter ? [bookingStatusFilter] : [""]}
            onValueChange={(e) =>
              handleBookingStatusFilter(e.value[0] || undefined)
            }
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="160px">
                {bookingStatusCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </HStack>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Payment:
          </Text>
          <Select.Root
            collection={paymentStatusCollection}
            size="xs"
            width={filterSelectWidth}
            borderColor="white"
            value={paymentStatusFilter ? [paymentStatusFilter] : [""]}
            onValueChange={(e) =>
              handlePaymentStatusFilter(e.value[0] || undefined)
            }
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="180px">
                {paymentStatusCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </HStack>
        {(missionId ||
          tripId ||
          boatId ||
          bookingStatusFilter ||
          paymentStatusFilter ||
          debouncedSearchQuery) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMissionId(undefined)
                setTripId(undefined)
                setBoatId(undefined)
                setBookingStatusFilter(undefined)
                setPaymentStatusFilter(undefined)
                setSearchQuery("")
                setDebouncedSearchQuery("")
                updateFiltersInUrl({
                  missionId: undefined,
                  tripId: undefined,
                  boatId: undefined,
                  bookingStatus: undefined,
                  paymentStatus: undefined,
                  search: undefined,
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
        <Table.Root
          size={{ base: "sm", md: "md" }}
          width="100%"
          style={{ tableLayout: "fixed" }}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="44"
                minW="36"
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
                w="48"
                minW="36"
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
                w="48"
                minW="36"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("trip_name")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Trip
                  <SortIcon column="trip_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="48"
                minW="36"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("booking_status")}
              >
                <Flex align="center">
                  Status
                  <SortIcon column="booking_status" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="24"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("total_amount")}
              >
                <Flex align="center">
                  Total
                  <SortIcon column="total_amount" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="16" fontWeight="bold" textAlign="center">
                Qty
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="44"
                minW="36"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("created_at")}
              >
                <Flex align="center">
                  Created at
                  <SortIcon column="created_at" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="44"
                minW="36"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("updated_at")}
              >
                <Flex align="center">
                  Updated at
                  <SortIcon column="updated_at" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="24" fontWeight="bold" whiteSpace="nowrap" textAlign="center">
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
                <Table.Cell w="44" minW="36">
                  <Flex align="center" gap={2}>
                    <Text
                      fontFamily="mono"
                      fontWeight="bold"
                      color="accent.default"
                      title={booking.confirmation_code}
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
                <Table.Cell
                  w="48"
                  minW="36"
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.mission_name || "N/A"}
                </Table.Cell>
                <Table.Cell
                  w="48"
                  minW="36"
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.trip_name?.trim() ||
                    (booking.trip_type
                      ? tripTypeToLabel(booking.trip_type)
                      : "N/A")}
                </Table.Cell>
                <Table.Cell w="48" minW="36">
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" color="text.muted">
                      Booking:{" "}
                      <Badge
                        size="sm"
                        colorPalette={getBookingStatusColor(
                          booking.booking_status || "",
                        )}
                      >
                        {formatBookingStatusLabel(booking.booking_status)}
                      </Badge>
                    </Text>
                    {booking.payment_status && (
                      <Text fontSize="xs" color="text.muted">
                        Payment:{" "}
                        <Badge
                          size="sm"
                          colorPalette={getPaymentStatusColor(
                            booking.payment_status,
                          )}
                        >
                          {formatPaymentStatusLabel(booking.payment_status)}
                        </Badge>
                      </Text>
                    )}
                    {isPartiallyRefunded(booking) && (
                      <Text fontSize="xs" color="text.muted">
                        Refunded ${formatCents(getRefundedCents(booking))}
                      </Text>
                    )}
                  </VStack>
                </Table.Cell>
                <Table.Cell w="24">
                  <Text fontWeight="bold">
                    ${formatCents(booking.total_amount)}
                  </Text>
                </Table.Cell>
                <Table.Cell w="16" textAlign="center">
                  {totalTicketQuantity(booking)}
                </Table.Cell>
                <Table.Cell w="44" minW="36">
                  {parseApiDate(booking.created_at).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Table.Cell>
                <Table.Cell w="44" minW="36">
                  {booking.updated_at
                    ? parseApiDate(booking.updated_at).toLocaleString(
                        undefined,
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )
                    : "—"}
                </Table.Cell>
                <Table.Cell
                  w="24"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Flex justify="center">
                    <BookingActionsMenu
                      booking={booking}
                      editDisabled={booking.booking_status === "checked_in"}
                    />
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
