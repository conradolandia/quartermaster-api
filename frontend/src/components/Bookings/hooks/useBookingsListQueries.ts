import { useQuery } from "@tanstack/react-query"
import type { TripPublic } from "@/client"
import {
  BoatsService,
  BookingsService,
  MissionsService,
  TripsService,
  TripBoatsService,
} from "@/client"
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "../types"
import type { SortableColumn } from "../types"

export interface UseBookingsListQueriesParams {
  page: number
  pageSize: number
  missionId: string | undefined
  launchId: string | undefined
  tripId: string | undefined
  boatId: string | undefined
  tripType: string | undefined
  bookingStatusFilter: string[]
  paymentStatusFilter: string[]
  debouncedSearchQuery: string
  sortBy: SortableColumn
  sortDirection: "asc" | "desc"
  includeArchived: boolean
}

export function useBookingsListQueries(params: UseBookingsListQueriesParams) {
  const {
    page,
    pageSize,
    missionId,
    launchId,
    tripId,
    boatId,
    tripType,
    bookingStatusFilter,
    paymentStatusFilter,
    debouncedSearchQuery,
    sortBy,
    sortDirection,
    includeArchived,
  } = params

  const {
    data: bookingsData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "bookings",
      page,
      pageSize,
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
        skip: (page - 1) * pageSize,
        limit: pageSize,
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
        sortBy,
        sortDirection,
        includeArchived,
      }),
  })

  const { data: missionsData } = useQuery({
    queryKey: ["missions", "for-bookings"],
    queryFn: () =>
      MissionsService.readMissions({ limit: 100, includeArchived: true }),
  })

  const { data: tripsData } = useQuery({
    queryKey: ["trips", "for-bookings"],
    queryFn: () =>
      TripsService.readTrips({ limit: 500, includeArchived: true }),
  })

  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 200 }),
  })

  const { data: tripBoatsData } = useQuery({
    queryKey: ["trip-boats", tripId],
    queryFn: () =>
      TripBoatsService.readTripBoatsByTrip({ tripId: tripId!, limit: 200 }),
    enabled: !!tripId,
  })

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

  const archivedTripIds = new Set(
    (trips as TripPublic[]).filter((t) => t.archived).map((t) => t.id),
  )
  const isBookingArchived = (booking: (typeof rawBookings)[0]) =>
    booking.items?.some((item) => archivedTripIds.has(item.trip_id)) ?? false

  const bookings = [...rawBookings].sort((a, b) => {
    const aArchived = isBookingArchived(a)
    const bArchived = isBookingArchived(b)
    if (aArchived !== bArchived) return aArchived ? 1 : -1
    return 0
  })

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

  const missionsWithBookings = missions
    .filter((m: { archived?: boolean }) => includeArchived || !m.archived)
    .filter((m: { id: string }) =>
      allBookingsData?.data?.some(
        (b: { mission_id?: string | null }) => b.mission_id === m.id,
      ),
    )

  const filteredTrips = (trips as TripPublic[])
    .filter((t) => includeArchived || !t.archived)
    .filter((t) => !missionId || t.mission_id === missionId)

  return {
    bookings,
    count,
    isLoading,
    isFetching,
    error,
    missions,
    trips,
    boats,
    filteredBoats,
    missionsWithBookings,
    filteredTrips,
    isBookingArchived,
    tripBoatsData,
  }
}
