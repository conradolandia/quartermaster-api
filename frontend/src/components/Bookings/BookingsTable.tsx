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
import { FiChevronDown, FiArrowDown, FiArrowUp, FiCopy, FiMail, FiPhone, FiSearch, FiX } from "react-icons/fi"

import {
  BoatsService,
  BookingsService,
  MissionsService,
  TripsService,
} from "@/client"
import type { TripPublic } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import PendingBookings from "@/components/Pending/PendingBookings"
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
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
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
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
  "free",
  "failed",
  "refunded",
  "partially_refunded",
] as const

function parseStatusList(
  param: string | null,
  all: readonly string[],
): string[] {
  if (!param?.trim()) return [...all]
  const parsed = param.split(",").map((s) => s.trim()).filter(Boolean)
  const valid = parsed.filter((s) => all.includes(s))
  return valid.length > 0 ? valid : [...all]
}

export default function BookingsTable({ onBookingClick }: BookingsTableProps) {
  const { showSuccessToast } = useCustomToast()
  useDateFormatPreference()
  const initialSearch = new URLSearchParams(window.location.search)
  const [missionId, setMissionId] = useState<string | undefined>(
    initialSearch.get("missionId") || undefined,
  )
  const [tripId, setTripId] = useState<string | undefined>(
    initialSearch.get("tripId") || undefined,
  )
  const [tripType, setTripType] = useState<string | undefined>(
    initialSearch.get("tripType") || undefined,
  )
  const [boatId, setBoatId] = useState<string | undefined>(
    initialSearch.get("boatId") || undefined,
  )
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string[]>(
    () =>
      parseStatusList(
        initialSearch.get("bookingStatuses"),
        BOOKING_STATUSES,
      ),
  )
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(
    () =>
      parseStatusList(
        initialSearch.get("paymentStatuses"),
        PAYMENT_STATUSES,
      ),
  )
  const [searchQuery, setSearchQuery] = useState<string>(
    initialSearch.get("search") || "",
  )
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    initialSearch.get("search") || "",
  )
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
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
      // Refocus search input after update so user can keep typing without re-clicking
      setTimeout(() => searchInputRef.current?.focus(), 0)
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
      setMissionId(params.get("missionId") || undefined)
      setTripId(params.get("tripId") || undefined)
      setBoatId(params.get("boatId") || undefined)
      setTripType(params.get("tripType") || undefined)
      const search = params.get("search") || ""
      setSearchQuery(search)
      setDebouncedSearchQuery(search)
      setBookingStatusFilter(
        parseStatusList(params.get("bookingStatuses"), BOOKING_STATUSES),
      )
      setPaymentStatusFilter(
        parseStatusList(params.get("paymentStatuses"), PAYMENT_STATUSES),
      )
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Fetch bookings with mission, trip, boat, status, search filters and sorting
  const {
    data: bookingsData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "bookings",
      page,
      effectivePageSize,
      missionId,
      tripId,
      boatId,
      tripType,
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
        tripType: tripType || undefined,
        bookingStatus:
          bookingStatusFilter.length > 0 &&
            bookingStatusFilter.length < BOOKING_STATUSES.length
            ? bookingStatusFilter
            : undefined,
        paymentStatus:
          paymentStatusFilter.length > 0 &&
            paymentStatusFilter.length < PAYMENT_STATUSES.length
            ? paymentStatusFilter
            : undefined,
        search: debouncedSearchQuery || undefined,
        sortBy: sortBy,
        sortDirection: sortDirection,
      }),
  })

  // Refocus search input when query finishes so table re-render doesn't leave focus lost
  const wasFetchingRef = useRef(false)
  useEffect(() => {
    if (wasFetchingRef.current && !isFetching && debouncedSearchQuery) {
      const active = document.activeElement
      const searchHadFocus =
        !active ||
        active === document.body ||
        searchInputRef.current === active ||
        searchInputRef.current?.contains(active)
      if (searchHadFocus) {
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
    }
    wasFetchingRef.current = isFetching
  }, [isFetching, debouncedSearchQuery])

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
    tripType?: string
    bookingStatuses?: string[]
    paymentStatuses?: string[]
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
    if (updates.tripType !== undefined) {
      if (updates.tripType) params.set("tripType", updates.tripType)
      else params.delete("tripType")
    }
    if (updates.bookingStatuses !== undefined) {
      const all =
        updates.bookingStatuses.length === BOOKING_STATUSES.length &&
        BOOKING_STATUSES.every((s) => updates.bookingStatuses!.includes(s))
      if (all) params.delete("bookingStatuses")
      else params.set("bookingStatuses", updates.bookingStatuses.join(","))
    }
    if (updates.paymentStatuses !== undefined) {
      const all =
        updates.paymentStatuses.length === PAYMENT_STATUSES.length &&
        PAYMENT_STATUSES.every((s) => updates.paymentStatuses!.includes(s))
      if (all) params.delete("paymentStatuses")
      else params.set("paymentStatuses", updates.paymentStatuses.join(","))
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

  const handleTripTypeFilter = (selectedTripType?: string) => {
    setTripType(selectedTripType)
    updateFiltersInUrl({ tripType: selectedTripType })
  }

  const toggleBookingStatus = (status: string) => {
    const next = bookingStatusFilter.includes(status)
      ? bookingStatusFilter.filter((s) => s !== status)
      : [...bookingStatusFilter, status]
    if (next.length === 0) return
    setBookingStatusFilter(next)
    updateFiltersInUrl({ bookingStatuses: next })
  }

  const togglePaymentStatus = (status: string) => {
    const next = paymentStatusFilter.includes(status)
      ? paymentStatusFilter.filter((s) => s !== status)
      : [...paymentStatusFilter, status]
    if (next.length === 0) return
    setPaymentStatusFilter(next)
    updateFiltersInUrl({ paymentStatuses: next })
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

  const tripTypeFilterCollection = createListCollection({
    items: [
      { label: "All Types", value: "" },
      { label: "Launch Viewing", value: "launch_viewing" },
      { label: "Pre-Launch", value: "pre_launch" },
    ],
  })

  const bookingStatusLabel =
    bookingStatusFilter.length === BOOKING_STATUSES.length
      ? "All"
      : `${bookingStatusFilter.length} of ${BOOKING_STATUSES.length}`
  const paymentStatusLabel =
    paymentStatusFilter.length === PAYMENT_STATUSES.length
      ? "All"
      : `${paymentStatusFilter.length} of ${PAYMENT_STATUSES.length}`

  const filterSelectWidth = "160px"
  const userTz =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"

  return (
    <>
      <VStack key="bookings-filter-bar" align="stretch" gap={3} mb={4}>
        <Flex align="center" gap={3}>
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Search:
          </Text>
          <InputGroup width="480px" maxWidth="100%" startElement={<Icon as={FiSearch} color="text.muted" boxSize={4} />}>
            <Input
              ref={searchInputRef}
              size="xs"
              placeholder="Search code, name, email, phone"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              borderColor="white"
            />
          </InputGroup>
        </Flex>
        <Flex gap={3} align="center" flexWrap="wrap">
          <HStack gap={3}>
            <Text fontSize="sm" fontWeight="medium" color="text.secondary">
              Booking:
            </Text>
            <MenuRoot closeOnSelect={false} positioning={{ sameWidth: true }}>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={filterSelectWidth}
                  borderColor="white"
                  justifyContent="space-between"
                >
                  {bookingStatusLabel}
                  <Icon as={FiChevronDown} ml={1} />
                </Button>
              </MenuTrigger>
              <MenuContent minWidth="180px">
                {BOOKING_STATUSES.map((status) => (
                  <MenuCheckboxItem
                    key={status}
                    checked={bookingStatusFilter.includes(status)}
                    onCheckedChange={() => toggleBookingStatus(status)}
                    value={status}
                  >
                    {status.replace(/_/g, " ").toUpperCase()}
                  </MenuCheckboxItem>
                ))}
              </MenuContent>
            </MenuRoot>
          </HStack>
          <HStack gap={3}>
            <Text fontSize="sm" fontWeight="medium" color="text.secondary">
              Payment:
            </Text>
            <MenuRoot closeOnSelect={false} positioning={{ sameWidth: true }}>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={filterSelectWidth}
                  borderColor="white"
                  justifyContent="space-between"
                >
                  {paymentStatusLabel}
                  <Icon as={FiChevronDown} ml={1} />
                </Button>
              </MenuTrigger>
              <MenuContent minWidth="200px">
                {PAYMENT_STATUSES.map((status) => (
                  <MenuCheckboxItem
                    key={status}
                    checked={paymentStatusFilter.includes(status)}
                    onCheckedChange={() => togglePaymentStatus(status)}
                    value={status}
                  >
                    {status.replace(/_/g, " ").toUpperCase()}
                  </MenuCheckboxItem>
                ))}
              </MenuContent>
            </MenuRoot>
          </HStack>
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
              Type:
            </Text>
            <Select.Root
              collection={tripTypeFilterCollection}
              size="xs"
              width={filterSelectWidth}
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
                  {tripTypeFilterCollection.items.map((item) => (
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
          <Button
            size="sm"
            variant="ghost"
            visibility={
              missionId ||
                tripId ||
                boatId ||
                tripType ||
                bookingStatusFilter.length < BOOKING_STATUSES.length ||
                paymentStatusFilter.length < PAYMENT_STATUSES.length ||
                debouncedSearchQuery
                ? "visible"
                : "hidden"
            }
            disabled={
              !missionId &&
              !tripId &&
              !boatId &&
              !tripType &&
              bookingStatusFilter.length >= BOOKING_STATUSES.length &&
              paymentStatusFilter.length >= PAYMENT_STATUSES.length &&
              !debouncedSearchQuery
            }
            onClick={() => {
              setMissionId(undefined)
              setTripId(undefined)
              setBoatId(undefined)
              setTripType(undefined)
              setBookingStatusFilter([...BOOKING_STATUSES])
              setPaymentStatusFilter([...PAYMENT_STATUSES])
              setSearchQuery("")
              setDebouncedSearchQuery("")
              updateFiltersInUrl({
                missionId: undefined,
                tripId: undefined,
                boatId: undefined,
                tripType: undefined,
                bookingStatuses: [...BOOKING_STATUSES],
                paymentStatuses: [...PAYMENT_STATUSES],
                search: undefined,
              })
            }}
          >
            <Flex align="center" gap={1}>
              <FiX />
              Clear filters
            </Flex>
          </Button>
        </Flex>
      </VStack>

      <Box overflowX="auto">
        <Table.Root
          size="sm"
          width="100%"
          style={{ tableLayout: "fixed" }}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="36"
                minW="28"
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
                w="52"
                minW="40"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_name")}
              >
                <Flex align="center">
                  Customer info
                  <SortIcon column="user_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="24"
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
                w="40"
                minW="28"
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
                minW="232px"
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
                w="20"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("total_amount")}
              >
                <Flex align="center">
                  Total
                  <SortIcon column="total_amount" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="12" fontWeight="bold" textAlign="center">
                Qty
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="36"
                minW="28"
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
                w="36"
                minW="28"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("updated_at")}
              >
                <Flex align="center">
                  Updated at
                  <SortIcon column="updated_at" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="20" fontWeight="bold" whiteSpace="nowrap" textAlign="center">
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
                <Table.Cell w="36" minW="28">
                  <Flex align="center" gap={2}>
                    <Text
                      fontFamily="mono"
                      fontWeight="semibold"
                      fontSize="sm"
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
                <Table.Cell w="52" minW="40">
                  <VStack align="stretch" gap={0}>
                    <Text fontSize="md">{booking.user_name}</Text>
                    <HStack gap={1}>
                      <Icon as={FiMail} boxSize={3} color="text.muted" />
                      <Text fontSize="xs" color="text.muted" title={booking.user_email}>
                        {booking.user_email}
                      </Text>
                    </HStack>
                    <HStack gap={1}>
                      <Icon as={FiPhone} boxSize={3} color="text.muted" />
                      <Text fontSize="xs" color="text.muted" title={booking.user_phone}>
                        {booking.user_phone}
                      </Text>
                    </HStack>
                  </VStack>
                </Table.Cell>
                <Table.Cell
                  w="40"
                  minW="28"
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.mission_name || "N/A"}
                </Table.Cell>
                <Table.Cell
                  w="40"
                  minW="28"
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.trip_name?.trim() ||
                    (booking.trip_type
                      ? tripTypeToLabel(booking.trip_type)
                      : "N/A")}
                </Table.Cell>
                <Table.Cell w="48" minW="232px">
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" color="text.muted">
                      Booking:{" "}
                      <Badge
                        size="xs"
                        colorPalette={getBookingStatusColor(
                          booking.booking_status || "",
                        )}
                      >
                        {formatBookingStatusLabel(booking.booking_status)}
                      </Badge>
                    </Text>
                    {booking.payment_status && (
                      <Text fontSize="xs" color="text.muted" whiteSpace="nowrap">
                        Payment:{" "}
                        {isPartiallyRefunded(booking) ? (
                          <>
                            <Badge
                              size="xs"
                              colorPalette={getPaymentStatusColor("paid")}
                            >
                              {formatPaymentStatusLabel("paid")}
                            </Badge>{" "}
                            <Badge
                              size="xs"
                              colorPalette="red"
                            >
                              {formatPaymentStatusLabel("partially_refunded")}
                            </Badge>
                          </>
                        ) : (
                          <Badge
                            size="xs"
                            colorPalette={getPaymentStatusColor(
                              booking.payment_status,
                            )}
                          >
                            {formatPaymentStatusLabel(booking.payment_status)}
                          </Badge>
                        )}
                      </Text>
                    )}
                    {isPartiallyRefunded(booking) && (
                      <Text fontSize="xs" color="text.muted">
                        Refunded ${formatCents(getRefundedCents(booking))}
                      </Text>
                    )}
                  </VStack>
                </Table.Cell>
                <Table.Cell w="20">
                  <Text fontWeight="bold">
                    ${formatCents(booking.total_amount)}
                  </Text>
                </Table.Cell>
                <Table.Cell w="12" textAlign="center">
                  {totalTicketQuantity(booking)}
                </Table.Cell>
                <Table.Cell w="36" minW="28">
                  {formatDateTimeInLocationTz(booking.created_at, userTz) ||
                    parseApiDate(booking.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                </Table.Cell>
                <Table.Cell w="36" minW="28">
                  {booking.updated_at
                    ? formatDateTimeInLocationTz(booking.updated_at, userTz) ||
                    parseApiDate(booking.updated_at).toLocaleString(
                      undefined,
                      { dateStyle: "short", timeStyle: "short" },
                    )
                    : "—"}
                </Table.Cell>
                <Table.Cell
                  w="20"
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
