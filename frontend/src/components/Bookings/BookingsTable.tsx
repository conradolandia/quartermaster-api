import {
  Badge,
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Table,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FiArrowDown, FiArrowUp, FiCopy, FiMail, FiPhone } from "react-icons/fi"

import {
  BoatsService,
  BookingsService,
  MissionsService,
  TripsService,
  TripBoatsService,
} from "@/client"
import type { TripPublic } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import PendingBookings from "@/components/Pending/PendingBookings"
import BookingsFilterBar from "@/components/Bookings/BookingsFilterBar"
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
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatCents,
  formatDateTimeInLocationTz,
  parseApiDate,
} from "@/utils"
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type SortDirection,
  type SortableColumn,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  getBookingStatusColor,
  getPaymentStatusColor,
  getRefundedCents,
  isPartiallyRefunded,
  parseStatusList,
  totalTicketQuantity,
} from "./types"

interface BookingsTableProps {
  onBookingClick: (confirmationCode: string) => void
}

export default function BookingsTable({ onBookingClick }: BookingsTableProps) {
  const { showSuccessToast } = useCustomToast()
  useDateFormatPreference()
  const initialSearch = new URLSearchParams(window.location.search)
  const [missionId, setMissionId] = useState<string | undefined>(
    initialSearch.get("missionId") || undefined,
  )
  const [launchId, setLaunchId] = useState<string | undefined>(
    initialSearch.get("launchId") || undefined,
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
  const { includeArchived, setIncludeArchived } = useIncludeArchived()
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
      setLaunchId(params.get("launchId") || undefined)
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
      launchId,
      tripId,
      boatId,
      tripType,
      bookingStatusFilter,
      paymentStatusFilter,
      debouncedSearchQuery || null,
      sortBy,
      sortDirection,
      includeArchived,
    ],
    queryFn: () =>
      BookingsService.listBookings({
        skip: (page - 1) * effectivePageSize,
        limit: effectivePageSize,
        missionId: missionId || undefined,
        launchId: launchId || undefined,
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
        includeArchived: includeArchived,
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

  // Fetch all missions (including archived for name resolution)
  const { data: missionsData } = useQuery({
    queryKey: ["missions", "for-bookings"],
    queryFn: () => MissionsService.readMissions({ limit: 100, includeArchived: true }),
  })

  // Fetch all trips (including archived for name resolution and archived detection)
  const { data: tripsData } = useQuery({
    queryKey: ["trips", "for-bookings"],
    queryFn: () =>
      TripsService.readTrips({ limit: 500, includeArchived: true }),
  })

  // Fetch boats for filter dropdown
  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 200 }),
  })

  // Fetch trip boats when a trip is selected (to filter boat dropdown)
  const { data: tripBoatsData } = useQuery({
    queryKey: ["trip-boats", tripId],
    queryFn: () =>
      TripBoatsService.readTripBoatsByTrip({ tripId: tripId!, limit: 200 }),
    enabled: !!tripId,
  })

  // Fetch all bookings to determine which missions have bookings
  const { data: allBookingsData } = useQuery({
    queryKey: ["all-bookings-for-missions", { includeArchived }],
    queryFn: () =>
      BookingsService.listBookings({ limit: 1000, includeArchived }),
  })

  const rawBookings = bookingsData?.data || []
  const count = bookingsData?.total || 0
  const missions = missionsData?.data || []
  const trips = tripsData?.data || []
  const boats = boatsData?.data || []

  // Identify archived trips so we can style/sort archived bookings
  const archivedTripIds = new Set(
    (trips as TripPublic[]).filter((t) => t.archived).map((t) => t.id),
  )
  const isBookingArchived = (booking: (typeof rawBookings)[0]) =>
    booking.items?.some((item) => archivedTripIds.has(item.trip_id)) ?? false

  // Sort archived bookings to the bottom
  const bookings = [...rawBookings].sort((a, b) => {
    const aArchived = isBookingArchived(a)
    const bArchived = isBookingArchived(b)
    if (aArchived !== bArchived) return aArchived ? 1 : -1
    return 0
  })

  // When a trip is selected, only show boats that exist for that trip
  const tripBoats = Array.isArray(tripBoatsData) ? tripBoatsData : []
  const boatIdsForTrip = new Set(
    tripBoats.map((tb: { boat_id: string }) => tb.boat_id),
  )
  const filteredBoats =
    tripId && boatIdsForTrip.size > 0
      ? (boats as { id: string; name: string }[]).filter((b) =>
          boatIdsForTrip.has(b.id),
        )
      : (boats as { id: string; name: string }[])

  // Clear boatId when it's invalid for the selected trip (e.g. from URL)
  useEffect(() => {
    if (!tripId || !boatId) return
    const tb = Array.isArray(tripBoatsData) ? tripBoatsData : []
    const ids = new Set(tb.map((x: { boat_id: string }) => x.boat_id))
    if (ids.size > 0 && !ids.has(boatId)) {
      setBoatId(undefined)
      updateFiltersInUrl({ boatId: undefined })
    }
  }, [tripId, boatId, tripBoatsData])

  // Filter missions to only show those with existing bookings, respecting archived state
  const missionsWithBookings = missions
    .filter((mission: any) => includeArchived || !mission.archived)
    .filter((mission: any) =>
      allBookingsData?.data?.some(
        (booking: any) => booking.mission_id === mission.id,
      ),
    )

  // Filter trips by selected mission, respecting archived state
  const filteredTrips = (trips as TripPublic[])
    .filter((t) => includeArchived || !t.archived)
    .filter((t) => !missionId || t.mission_id === missionId)

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
    launchId?: string
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
    if (updates.launchId !== undefined) {
      if (updates.launchId) params.set("launchId", updates.launchId)
      else params.delete("launchId")
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
    setLaunchId(undefined)
    setTripId(undefined)
    updateFiltersInUrl({
      missionId: selectedMissionId,
      launchId: undefined,
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

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    const params = new URLSearchParams(window.location.search)
    params.set("page", "1")
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    )
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const applyBookingStatus = (next: string[]) => {
    if (next.length === 0) return
    if (
      next.length === bookingStatusFilter.length &&
      next.every((s, i) => s === bookingStatusFilter[i])
    ) {
      return
    }
    setBookingStatusFilter(next)
    updateFiltersInUrl({ bookingStatuses: next })
  }

  const applyPaymentStatus = (next: string[]) => {
    if (next.length === 0) return
    if (
      next.length === paymentStatusFilter.length &&
      next.every((s, i) => s === paymentStatusFilter[i])
    ) {
      return
    }
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
      ...filteredBoats.map((boat: { id: string; name: string }) => ({
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

  const userTz =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"

  const hasActiveFilters = !!(
    missionId ||
    tripId ||
    boatId ||
    tripType ||
    bookingStatusFilter.length < BOOKING_STATUSES.length ||
    paymentStatusFilter.length < PAYMENT_STATUSES.length ||
    debouncedSearchQuery
  )

  const handleClearFilters = () => {
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
  }

  return (
    <>
      <BookingsFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
        includeArchived={includeArchived}
        onIncludeArchivedChange={handleIncludeArchivedChange}
        bookingStatusLabel={bookingStatusLabel}
        paymentStatusLabel={paymentStatusLabel}
        bookingStatusFilter={bookingStatusFilter}
        paymentStatusFilter={paymentStatusFilter}
        onApplyBookingStatus={applyBookingStatus}
        onApplyPaymentStatus={applyPaymentStatus}
        missionId={missionId}
        onMissionFilter={handleMissionFilter}
        missionsCollection={missionsCollection}
        tripId={tripId}
        onTripFilter={handleTripFilter}
        tripsCollection={tripsCollection}
        tripType={tripType}
        onTripTypeFilter={handleTripTypeFilter}
        tripTypeFilterCollection={tripTypeFilterCollection}
        boatId={boatId}
        onBoatFilter={handleBoatFilter}
        boatsCollection={boatsCollection}
        filteredBoats={filteredBoats}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      <Box overflowX="auto">
        <Table.Root
          size="sm"
          width="100%"
          style={{ tableLayout: "fixed" }}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="28"
                minW="20"
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
                onClick={() => handleSort("last_name")}
              >
                <Flex align="center">
                  Customer info
                  <SortIcon column="last_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="36"
                minW="28"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("mission_name")}
              >
                <Flex align="center">
                  Mission
                  <SortIcon column="mission_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="32"
                minW="24"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("trip_name")}
              >
                <Flex align="center">
                  Trip
                  <SortIcon column="trip_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="40" fontWeight="bold">
                Boat
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="52"
                minW="180px"
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
                minW="5rem"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("total_amount")}
                whiteSpace="nowrap"
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
            {bookings.map((booking) => {
              const bookingArchived = isBookingArchived(booking)
              return (
              <Table.Row
                key={booking.id}
                cursor="pointer"
                onClick={() => onBookingClick(booking.confirmation_code)}
                opacity={bookingArchived ? 0.6 : 1}
                bg={bookingArchived ? "bg.muted" : undefined}
              >
                <Table.Cell w="28" minW="20">
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
                    <Text fontSize="sm">
                      {[booking.first_name, booking.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </Text>
                    <HStack gap={1}>
                      <Icon as={FiMail} boxSize={3} color="text.muted" />
                      <Text fontSize="sm" color="text.muted" title={booking.user_email}>
                        {booking.user_email}
                      </Text>
                    </HStack>
                    <HStack gap={1}>
                      <Icon as={FiPhone} boxSize={3} color="text.muted" />
                      <Text fontSize="sm" color="text.muted" title={booking.user_phone}>
                        {booking.user_phone}
                      </Text>
                    </HStack>
                  </VStack>
                </Table.Cell>
                <Table.Cell w="36" minW="28">
                  {booking.mission_name || "N/A"}
                </Table.Cell>
                <Table.Cell w="32" minW="24">
                  {booking.trip_name?.trim() ||
                    (booking.trip_type
                      ? tripTypeToLabel(booking.trip_type)
                      : "N/A")}
                </Table.Cell>
                <Table.Cell w="24">
                  {booking.items?.[0]?.boat_id
                    ? boats.find(
                        (b: { id: string; name: string }) =>
                          b.id === booking.items?.[0]?.boat_id,
                      )?.name ?? "—"
                    : "—"}
                </Table.Cell>
                <Table.Cell w="52" minW="180px">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" color="text.muted">
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
                      <Text fontSize="sm" color="text.muted" whiteSpace="nowrap">
                        Payment:{" "}
                        {isPartiallyRefunded(booking) ? (
                          <Badge
                            size="xs"
                            colorPalette="red"
                          >
                            {formatPaymentStatusLabel("partially_refunded")}
                          </Badge>
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
                      <Text fontSize="sm" color="text.muted">
                        Refunded ${formatCents(getRefundedCents(booking))}
                      </Text>
                    )}
                  </VStack>
                </Table.Cell>
                <Table.Cell w="20" minW="5rem" whiteSpace="nowrap">
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
                      archived={bookingArchived}
                    />
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
