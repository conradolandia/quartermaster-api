import {
  Box,
  Flex,
  Grid,
  Heading,
  Link,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { ReactNode } from "react"

import {
  BoatsService,
  LaunchesService,
  MissionsService,
  TripBoatsService,
  TripsService,
} from "@/client"
import type { BookingPublic } from "@/client"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import {
  formatDateTimeInLocationTz,
  formatInLocationTimezoneWithAbbr,
  getTimezoneAbbr,
  getUseInternationalDateFormat,
  parseApiDate,
} from "@/utils"
import { formatInTimeZone } from "date-fns-tz/formatInTimeZone"
import { enUS } from "date-fns/locale/en-US"
import { tripTypeToLabel } from "./types"

function formatDepartureDateTimeInLocationTz(
  dateString: string | null | undefined,
  timezone?: string | null,
): string {
  if (!dateString) return ""
  const d = parseApiDate(dateString)
  if (Number.isNaN(d.getTime())) return ""
  if (timezone) {
    if (getUseInternationalDateFormat()) {
      const dateTime = formatInTimeZone(d, timezone, "yyyy-MM-dd HH:mm", {
        locale: enUS,
      })
      return `${dateTime} ${getTimezoneAbbr(timezone)}`
    }
    const parts = formatInLocationTimezoneWithAbbr(d, timezone)
    if (parts) return `${parts.dateTime} ${parts.timezoneAbbr}`
  }
  return formatDateTimeInLocationTz(dateString, timezone)
}

interface BookingExperienceDetailsProps {
  booking: BookingPublic
  /** Use public API endpoints (for unauthenticated / public pages). */
  usePublicApis?: boolean
  /** Section heading. */
  heading?: string
  /** Whether to render the heading inside the component (false when parent renders it outside). */
  showHeading?: boolean
  /** Use single-column layout (for narrow containers, e.g. public booking detail). Defaults to true when usePublicApis is true. */
  narrowLayout?: boolean
  /** Styling: border, bg, etc. Passed to outer Box. */
  boxProps?: Record<string, unknown>
  /** Compact check-in layout: Mission, Trip, Departure, Boat only; no separator. */
  variant?: "full" | "checkIn"
  /** Show separator below heading (default true). */
  showSeparator?: boolean
}

export default function BookingExperienceDetails({
  booking,
  usePublicApis = false,
  heading = "Mission, launch & trip",
  showHeading = true,
  narrowLayout = usePublicApis,
  boxProps = {},
  variant = "full",
  showSeparator = true,
}: BookingExperienceDetailsProps) {
  useDateFormatPreference()
  const firstItem = booking?.items?.[0]
  const tripId = firstItem?.trip_id

  const uniqueBoatIds = useMemo(() => {
    if (!booking?.items?.length) return []
    const ids = new Set<string>()
    for (const i of booking.items) {
      if (i.boat_id) ids.add(i.boat_id)
    }
    return Array.from(ids)
  }, [booking?.items])

  const { data: trip } = useQuery({
    queryKey: [usePublicApis ? "public-trip" : "trip", tripId],
    queryFn: () =>
      usePublicApis
        ? TripsService.readPublicTrip({ tripId: tripId! })
        : TripsService.readTrip({ tripId: tripId! }),
    enabled: !!tripId,
  })

  const { data: mission } = useQuery({
    queryKey: [usePublicApis ? "public-mission" : "mission", trip?.mission_id],
    queryFn: () =>
      usePublicApis
        ? MissionsService.readPublicMissions({ limit: 500 }).then((res) =>
            res.data.find((m) => m.id === trip!.mission_id),
          )
        : MissionsService.readMission({ missionId: trip!.mission_id }),
    enabled: !!trip?.mission_id,
  })

  const { data: launch } = useQuery({
    queryKey: [usePublicApis ? "public-launch" : "launch", mission?.launch_id],
    queryFn: () =>
      usePublicApis
        ? LaunchesService.readPublicLaunch({
            launchId: mission!.launch_id,
          })
        : LaunchesService.readLaunch({ launchId: mission!.launch_id }),
    enabled: !!mission?.launch_id,
  })

  const boatQueries = useQueries({
    queries: uniqueBoatIds.map((bid) => ({
      queryKey: [usePublicApis ? "public-boat" : "boat", bid],
      queryFn: () =>
        usePublicApis
          ? BoatsService.readPublicBoat({ boatId: bid })
          : BoatsService.readBoat({ boatId: bid }),
      enabled: !!bid,
    })),
  })

  const { data: tripBoats } = useQuery({
    queryKey: ["trip-boats-for-experience", tripId],
    queryFn: () => TripBoatsService.readTripBoatsByTrip({ tripId: tripId! }),
    enabled: !!tripId && !usePublicApis,
  })

  const { data: publicTripBoats } = useQuery({
    queryKey: ["public-trip-boats-for-experience", tripId],
    queryFn: () =>
      TripBoatsService.readPublicTripBoatsByTrip({ tripId: tripId! }),
    enabled: !!tripId && usePublicApis && !booking?.experience_display,
  })

  const exp = usePublicApis ? booking?.experience_display : null

  const captainNames = useMemo(() => {
    if (exp?.captain_name) return [exp.captain_name]
    const boatsForTrip = usePublicApis ? publicTripBoats : tripBoats
    if (!boatsForTrip?.length) return []
    const names = uniqueBoatIds
      .map((bid) => {
        const tb = boatsForTrip.find(
          (row) => String(row.boat_id) === String(bid),
        )
        return tb?.effective_captain?.trim() || null
      })
      .filter(Boolean) as string[]
    return [...new Set(names)]
  }, [
    exp?.captain_name,
    publicTripBoats,
    tripBoats,
    uniqueBoatIds,
    usePublicApis,
  ])

  const boatNames = useMemo(() => {
    const names = boatQueries
      .map((q) => (q.data as { name?: string } | undefined)?.name)
      .filter(Boolean) as string[]
    return [...new Set(names)]
  }, [boatQueries])

  if (!tripId || !firstItem) return null

  const Row = ({
    label,
    value,
    valueSmall,
  }: {
    label: string
    value: ReactNode
    valueSmall?: boolean
  }) => (
    <Flex gap={4} alignItems="baseline">
      <Text fontWeight="bold" minW="100px" fontSize="sm">
        {label}:
      </Text>
      <Text fontSize={valueSmall ? "xs" : "sm"}>{value}</Text>
    </Flex>
  )

  if (variant === "checkIn") {
    const tz = trip?.timezone ?? undefined
    const missionName = mission?.name
    const tripLabel = trip
      ? trip.name?.trim()
        ? `${trip.name.trim()} – ${tripTypeToLabel(trip.type)}`
        : tripTypeToLabel(trip.type)
      : null

    return (
      <Box {...boxProps}>
        {showHeading && (
          <Heading size="lg" mb={4}>
            {heading}
          </Heading>
        )}
        <VStack align="stretch" gap={3}>
          {missionName && <Row label="Mission" value={missionName} />}
          {tripLabel && <Row label="Trip" value={tripLabel} />}
          {trip?.departure_time && (
            <Row
              label="Departure"
              value={formatDepartureDateTimeInLocationTz(
                trip.departure_time,
                tz,
              )}
            />
          )}
          {boatNames.length > 0 && (
            <Row label="Boat" value={boatNames.join(", ")} />
          )}
          {captainNames.length > 0 && (
            <Row label="Captain" value={captainNames.join(", ")} />
          )}
        </VStack>
      </Box>
    )
  }

  // Public booking detail: use embedded experience_display when present (avoids read_public_trip 404 for past trips)
  if (exp) {
    return (
      <Box {...boxProps}>
        {showHeading && (
          <Heading size="md" mb={4}>
            {heading}
          </Heading>
        )}
        {showSeparator && <Separator mb={4} />}
        <Grid
          templateColumns={
            narrowLayout
              ? "1fr"
              : { base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }
          }
          gap={6}
        >
          <VStack align="stretch" gap={3}>
            {exp.launch_name && (
              <>
                <Row label="Launch" value={exp.launch_name} />
                {exp.launch_timestamp && (
                  <Row
                    label="Launch time"
                    value={formatDateTimeInLocationTz(
                      exp.launch_timestamp,
                      exp.launch_timezone,
                    )}
                  />
                )}
                {exp.launch_summary && (
                  <Row label="Summary" value={exp.launch_summary} valueSmall />
                )}
              </>
            )}
            {exp.mission_name && (
              <Row label="Mission" value={exp.mission_name} />
            )}
          </VStack>
          <VStack align="stretch" gap={3}>
            {(exp.trip_name || exp.trip_type) && (
              <>
                <Row
                  label="Trip"
                  value={
                    exp.trip_name?.trim()
                      ? `${exp.trip_name.trim()} – ${tripTypeToLabel(
                          exp.trip_type ?? "",
                        )}`
                      : tripTypeToLabel(exp.trip_type ?? "")
                  }
                />
                {exp.check_in_time && (
                  <Row
                    label="Check-in"
                    value={formatDateTimeInLocationTz(
                      exp.check_in_time,
                      exp.trip_timezone,
                    )}
                  />
                )}
                {exp.boarding_time && (
                  <Row
                    label="Boarding"
                    value={formatDateTimeInLocationTz(
                      exp.boarding_time,
                      exp.trip_timezone,
                    )}
                  />
                )}
                {exp.departure_time && (
                  <Row
                    label="Departure"
                    value={formatDateTimeInLocationTz(
                      exp.departure_time,
                      exp.trip_timezone,
                    )}
                  />
                )}
              </>
            )}
          </VStack>
          <VStack align="stretch" gap={3}>
            {exp.provider_name && (
              <Row label="Provider" value={exp.provider_name} />
            )}
            {exp.boat_name && <Row label="Boat" value={exp.boat_name} />}
            {exp.captain_name && (
              <Row label="Captain" value={exp.captain_name} />
            )}
            {exp.departure_location && (
              <Row
                label="Location"
                value={
                  exp.map_link ? (
                    <Link
                      href={exp.map_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {exp.departure_location}
                    </Link>
                  ) : (
                    exp.departure_location
                  )
                }
              />
            )}
          </VStack>
        </Grid>
      </Box>
    )
  }

  const tz = trip?.timezone ?? undefined

  return (
    <Box {...boxProps}>
      {showHeading && (
        <Heading size="lg" mb={4}>
          {heading}
        </Heading>
      )}
      {showSeparator && <Separator mb={4} />}
      <Grid
        templateColumns={
          narrowLayout
            ? "1fr"
            : { base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }
        }
        gap={6}
      >
        <VStack align="stretch" gap={3}>
          {launch && (
            <>
              <Row label="Launch" value={launch.name} />
              {launch.launch_timestamp && (
                <Row
                  label="Launch time"
                  value={formatDateTimeInLocationTz(
                    launch.launch_timestamp,
                    launch.timezone,
                  )}
                />
              )}
              {launch.summary && (
                <Row label="Summary" value={launch.summary} valueSmall />
              )}
            </>
          )}
          {mission && <Row label="Mission" value={mission.name} />}
        </VStack>
        <VStack align="stretch" gap={3}>
          {trip && (
            <>
              <Row
                label="Trip"
                value={
                  trip.name?.trim()
                    ? `${trip.name.trim()} – ${tripTypeToLabel(trip.type)}`
                    : tripTypeToLabel(trip.type)
                }
              />
              <Row
                label="Check-in"
                value={formatDateTimeInLocationTz(trip.check_in_time, tz)}
              />
              <Row
                label="Boarding"
                value={formatDateTimeInLocationTz(trip.boarding_time, tz)}
              />
              <Row
                label="Departure"
                value={formatDateTimeInLocationTz(trip.departure_time, tz)}
              />
            </>
          )}
        </VStack>
        <VStack align="stretch" gap={3}>
          {boatQueries[0]?.data?.provider?.name && (
            <Row
              label="Provider"
              value={
                (boatQueries[0].data as { provider?: { name?: string } })
                  .provider?.name
              }
            />
          )}
          {boatNames.length > 0 && (
            <Row label="Boat" value={boatNames.join(", ")} />
          )}
          {captainNames.length > 0 && (
            <Row label="Captain" value={captainNames.join(", ")} />
          )}
          {boatQueries[0]?.data?.provider?.address &&
            (() => {
              const b = boatQueries[0].data as {
                provider?: { address?: string; map_link?: string }
              }
              const prov = b?.provider
              return (
                <Row
                  label="Location"
                  value={
                    prov?.map_link ? (
                      <Link
                        href={prov.map_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {prov.address}
                      </Link>
                    ) : (
                      prov?.address
                    )
                  }
                />
              )
            })()}
        </VStack>
      </Grid>
    </Box>
  )
}
