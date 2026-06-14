import type { DiscountCodePublic } from "@/client"

export type TripAccessContext = {
  id: string
  mission_id: string
  type: string
}

export function isAccessOnlyCode(dc: DiscountCodePublic): boolean {
  return Boolean(dc.is_access_code && dc.discount_value === 0)
}

/**
 * Whether an access-only code may be used for the given trip (mirrors backend
 * restriction checks plus legacy access_code_mission_id).
 */
export function accessCodeMatchesTrip(
  dc: DiscountCodePublic,
  trip: TripAccessContext,
  launchId?: string | null,
): boolean {
  if (!isAccessOnlyCode(dc)) return false

  if (
    dc.access_code_mission_id &&
    dc.access_code_mission_id !== trip.mission_id
  ) {
    return false
  }
  if (dc.restricted_trip_id && dc.restricted_trip_id !== trip.id) {
    return false
  }
  if (
    dc.restricted_mission_id &&
    dc.restricted_mission_id !== trip.mission_id
  ) {
    return false
  }
  if (dc.restricted_trip_type && dc.restricted_trip_type !== trip.type) {
    return false
  }
  if (dc.restricted_launch_id) {
    if (!launchId || dc.restricted_launch_id !== launchId) {
      return false
    }
  }

  return true
}

function accessCodeSpecificity(
  dc: DiscountCodePublic,
  trip: TripAccessContext,
): number {
  if (dc.restricted_trip_id === trip.id) return 5
  if (dc.restricted_mission_id === trip.mission_id) return 4
  if (dc.access_code_mission_id === trip.mission_id) return 3
  if (dc.restricted_launch_id) return 2
  if (dc.restricted_trip_type === trip.type) return 1
  return 0
}

/**
 * Pick the best access-only code for a trip booking link: trip-restricted first,
 * then mission/launch/type-scoped, then fully unrestricted. Returns undefined
 * when no valid code exists.
 */
export function pickAccessCodeForTrip(
  codes: DiscountCodePublic[],
  trip: TripAccessContext,
  launchId?: string | null,
): DiscountCodePublic | undefined {
  const matching = codes.filter((dc) =>
    accessCodeMatchesTrip(dc, trip, launchId),
  )
  if (matching.length === 0) return undefined

  return matching.reduce((best, dc) =>
    accessCodeSpecificity(dc, trip) > accessCodeSpecificity(best, trip)
      ? dc
      : best,
  )
}
