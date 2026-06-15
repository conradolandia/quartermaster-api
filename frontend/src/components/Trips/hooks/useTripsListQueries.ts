import type { TripBoatPublicWithAvailability, TripWithStats } from "@/client"
import { MissionsService, TripBoatsService } from "@/client"
import { useQueries, useQuery } from "@tanstack/react-query"
import {
  type SortDirection,
  type SortableColumn,
  getTripsQueryOptions,
  sortTripsWithStats,
} from "../types"

export interface UseTripsListQueriesParams {
  page: number
  pageSize: number
  missionId: string | undefined
  tripType: string | undefined
  includeArchived: boolean
  sortBy: SortableColumn
  sortDirection: SortDirection
}

export function useTripsListQueries(params: UseTripsListQueriesParams) {
  const {
    page,
    pageSize,
    missionId,
    tripType,
    includeArchived,
    sortBy,
    sortDirection,
  } = params

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getTripsQueryOptions({
      page,
      pageSize,
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

  const tripsData = data?.data ?? []
  const count = data?.count ?? 0

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

  const missionsMap = new Map<
    string,
    { id: string; name: string; archived?: boolean }
  >()
  if (missionsData?.data) {
    for (const mission of missionsData.data) {
      missionsMap.set(mission.id, mission)
    }
  }

  const missionsForDropdown = (missionsData?.data ?? []).filter(
    (m) => includeArchived || !m.archived,
  )

  const tripsToShow = sortTripsWithStats(
    tripsData as TripWithStats[],
    sortBy || "check_in_time",
    sortDirection || "desc",
    tripBoatsByTrip,
  )

  return {
    tripsToShow,
    count,
    isLoading,
    isPlaceholderData,
    missionsMap,
    tripBoatsByTrip,
    missionsForDropdown,
  }
}
