import type { TripBoatPublicWithAvailability, TripWithStats } from "@/client"
import { TripsService } from "@/client"
import { parseApiDate } from "@/utils"

export type SortableColumn =
  | "name"
  | "type"
  | "mission_id"
  | "check_in_time"
  | "departure_time"
  | "active"
  | "total_bookings"
  | "total_sales"
  | "boat_names"

export type SortDirection = "asc" | "desc"

export const TRIP_TYPES = [
  { label: "All Types", value: "" },
  { label: "Launch Viewing", value: "launch_viewing" },
  { label: "Pre-Launch", value: "pre_launch" },
] as const

export const DESKTOP_FILTER_MIN_WIDTH = "100px"

export function getTripsQueryOptions({
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
    queryKey: [
      "trips",
      { page, pageSize, missionId, tripType, includeArchived },
    ],
  }
}

/** Paid bookings only (excludes checkout holds). */
export function committedSeatsFromTripBoat(
  tb: TripBoatPublicWithAvailability,
): number {
  const c = tb.committed_per_ticket_type
  if (c == null || typeof c !== "object") return 0
  return Object.values(c).reduce((a, b) => a + b, 0)
}

/** Paid plus active holds — same basis as remaining_capacity. */
export function capacityUsedFromTripBoat(
  tb: TripBoatPublicWithAvailability,
): number {
  const u = tb.used_per_ticket_type
  if (u == null || typeof u !== "object") return 0
  return Object.values(u).reduce((a, b) => a + b, 0)
}

function boatNamesSortKey(
  boats: TripBoatPublicWithAvailability[] | undefined,
): string {
  if (!boats?.length) return ""
  const names = boats
    .map((tb) => tb.boat?.name ?? "Boat")
    .filter(Boolean)
    .sort()
  return names.join(", ")
}

export function sortTripsWithStats(
  trips: TripWithStats[],
  sortBy: SortableColumn,
  sortDirection: SortDirection,
  tripBoatsByTrip?: Record<string, TripBoatPublicWithAvailability[]>,
): TripWithStats[] {
  const effectiveSortBy = sortBy || "check_in_time"
  const effectiveSortDirection = sortDirection || "desc"
  return [...trips].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    let aValue: unknown = a[effectiveSortBy as keyof TripWithStats]
    let bValue: unknown = b[effectiveSortBy as keyof TripWithStats]

    if (effectiveSortBy === "boat_names" && tripBoatsByTrip) {
      aValue = boatNamesSortKey(tripBoatsByTrip[a.id])
      bValue = boatNamesSortKey(tripBoatsByTrip[b.id])
    }

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
}

export function getLabelForValue(
  collection: { items: Array<{ label: string; value: string }> },
  value: string | undefined,
): string {
  const v = value ?? ""
  const match = collection.items.find((item) => item.value === v)
  if (match) return match.label
  return collection.items[0]?.label ?? ""
}
