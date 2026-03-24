import {
  Box,
  Flex,
  Table,
  Text,
  createListCollection,
  type ListCollection,
} from "@chakra-ui/react"
import { useEffect, useRef } from "react"

import type { TripPublic } from "@/client"
import PendingBookings from "@/components/Pending/PendingBookings"
import BookingsFilterBar from "@/components/Bookings/BookingsFilterBar"
import { PageSizeSelect } from "@/components/ui/page-size-select"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import useCustomToast from "@/hooks/useCustomToast"
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  formatTripFilterLabel,
  getItemTypeLabel,
} from "./types"
import BookingsTableHeader from "./BookingsTableHeader"
import BookingsTableRow from "./BookingsTableRow"
import { useBookingsListQueries } from "./hooks/useBookingsListQueries"
import { useBookingsTableState } from "./hooks/useBookingsTableState"

interface BookingsTableProps {
  onBookingClick: (confirmationCode: string) => void
}

export default function BookingsTable({ onBookingClick }: BookingsTableProps) {
  const { showSuccessToast } = useCustomToast()
  useDateFormatPreference()

  const state = useBookingsTableState()
  const {
    missionId,
    launchId,
    tripId,
    boatId,
    setBoatId,
    tripType,
    ticketItemType,
    bookingStatusFilter,
    paymentStatusFilter,
    includeArchived,
    searchQuery,
    debouncedSearchQuery,
    searchInputRef,
    page,
    effectivePageSize,
    sortBy,
    sortDirection,
    updateFiltersInUrl,
    handleSort,
    handleSearchChange,
    handleMissionFilter,
    handleTripFilter,
    handleBoatFilter,
    handleTripTypeFilter,
    handleTicketItemTypeFilter,
    handleIncludeArchivedChange,
    applyBookingStatus,
    applyPaymentStatus,
    handlePageChange,
    handlePageSizeChange,
    hasActiveFilters,
    handleClearFilters,
  } = state

  const copyConfirmationCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(code).then(() => {
      showSuccessToast("Confirmation code copied to clipboard")
    })
  }

  const {
    bookings,
    count,
    isLoading,
    isFetching,
    error,
    boats,
    filteredBoats,
    missionsWithBookings,
    filteredTrips,
    isBookingArchived,
    tripBoatsData,
    ticketItemTypeOptions,
  } = useBookingsListQueries({
    page,
    pageSize: effectivePageSize,
    missionId,
    launchId,
    tripId,
    boatId,
    tripType,
    ticketItemType,
    bookingStatusFilter,
    paymentStatusFilter,
    debouncedSearchQuery,
    sortBy,
    sortDirection,
    includeArchived,
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

  if (isLoading) {
    return <PendingBookings />
  }

  if (error) {
    return <Text>Error loading bookings</Text>
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

  const ticketTypesForSelect =
    ticketItemType &&
    !ticketItemTypeOptions.includes(ticketItemType)
      ? [...ticketItemTypeOptions, ticketItemType].sort((a, b) =>
          a.localeCompare(b),
        )
      : ticketItemTypeOptions

  const ticketItemTypeCollection = createListCollection({
    items: [
      { label: "All ticket types", value: "" },
      ...ticketTypesForSelect.map((t: string) => ({
        label: getItemTypeLabel(t),
        value: t,
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
        missionsCollection={missionsCollection as ListCollection<{ label: string; value: string }>}
        tripId={tripId}
        onTripFilter={handleTripFilter}
        tripsCollection={tripsCollection as ListCollection<{ label: string; value: string }>}
        tripType={tripType}
        onTripTypeFilter={handleTripTypeFilter}
        tripTypeFilterCollection={tripTypeFilterCollection as ListCollection<{ label: string; value: string }>}
        boatId={boatId}
        onBoatFilter={handleBoatFilter}
        boatsCollection={boatsCollection as ListCollection<{ label: string; value: string }>}
        filteredBoats={filteredBoats}
        ticketItemType={ticketItemType}
        onTicketItemTypeFilter={handleTicketItemTypeFilter}
        ticketItemTypeCollection={
          ticketItemTypeCollection as ListCollection<{ label: string; value: string }>
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      <Box overflowX="auto">
        <Table.Root
          size="sm"
          width="100%"
          style={{ tableLayout: "fixed" }}
        >
          <BookingsTableHeader
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <Table.Body>
            {bookings.map((booking) => (
              <BookingsTableRow
                key={booking.id}
                booking={booking}
                boats={boats as { id: string; name: string }[]}
                archived={isBookingArchived(booking)}
                userTz={userTz}
                onCopyCode={copyConfirmationCode}
                onRowClick={onBookingClick}
              />
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
