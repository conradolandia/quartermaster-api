import { Box, Flex, Grid, Heading, Text, VStack } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"

import {
  BoatsService,
  LaunchesService,
  MissionsService,
  TripsService,
} from "@/client"
import type { BookingPublic } from "@/client"
import { formatDateTimeInLocationTz } from "@/utils"

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
}

const tripTypeToLabel = (type: string): string => {
  if (type === "launch_viewing") return "Launch Viewing"
  if (type === "pre_launch") return "Pre-Launch"
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function BookingExperienceDetails({
  booking,
  usePublicApis = false,
  heading = "Mission, launch & trip",
  showHeading = true,
  narrowLayout = usePublicApis,
  boxProps = {},
}: BookingExperienceDetailsProps) {
  const firstItem = booking?.items?.[0]
  const tripId = firstItem?.trip_id
  const boatId = firstItem?.boat_id

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
    queryKey: [
      usePublicApis ? "public-launch" : "launch",
      mission?.launch_id,
    ],
    queryFn: () =>
      usePublicApis
        ? LaunchesService.readPublicLaunch({
            launchId: mission!.launch_id,
          })
        : LaunchesService.readLaunch({ launchId: mission!.launch_id }),
    enabled: !!mission?.launch_id,
  })

  const { data: boat } = useQuery({
    queryKey: [usePublicApis ? "public-boat" : "boat", boatId],
    queryFn: () =>
      usePublicApis
        ? BoatsService.readPublicBoat({ boatId: boatId! })
        : BoatsService.readBoat({ boatId: boatId! }),
    enabled: !!boatId,
  })

  const exp = usePublicApis ? booking?.experience_display : null

  if (!tripId || !firstItem) return null

  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <Flex gap={4} alignItems="baseline">
      <Text fontWeight="bold" minW="100px" fontSize="sm">
        {label}:
      </Text>
      <Text fontSize="sm">{value}</Text>
    </Flex>
  )

  // Public booking detail: use embedded experience_display when present (avoids read_public_trip 404 for past trips)
  if (exp) {
    return (
      <Box {...boxProps}>
        {showHeading && (
          <Heading size="md" mb={4}>
            {heading}
          </Heading>
        )}
        <Grid
          templateColumns={
            narrowLayout
              ? "1fr"
              : { base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }
          }
          gap={6}
        >
          <VStack align="stretch" gap={3}>
            {exp.mission_name && (
              <Row label="Mission" value={exp.mission_name} />
            )}
            {exp.launch_name && (
              <>
                <Row label="Launch" value={exp.launch_name} />
                {exp.launch_timestamp && (
                  <Row
                    label="Launch window"
                    value={formatDateTimeInLocationTz(
                      exp.launch_timestamp,
                      exp.launch_timezone,
                    )}
                  />
                )}
                {exp.launch_summary && (
                  <Row label="Summary" value={exp.launch_summary} />
                )}
              </>
            )}
          </VStack>
          <VStack align="stretch" gap={3}>
            {(exp.trip_name || exp.trip_type) && (
              <>
                <Row
                  label="Trip"
                  value={
                    exp.trip_name?.trim()
                      ? `${exp.trip_name.trim()} – ${tripTypeToLabel(exp.trip_type ?? "")}`
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
            {exp.boat_name && (
              <Row label="Boat" value={exp.boat_name} />
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
        <Heading size="md" mb={4}>
          {heading}
        </Heading>
      )}
      <Grid
        templateColumns={
          narrowLayout
            ? "1fr"
            : { base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }
        }
        gap={6}
      >
        <VStack align="stretch" gap={3}>
          {mission && <Row label="Mission" value={mission.name} />}
          {launch && (
            <>
              <Row label="Launch" value={launch.name} />
              {launch.launch_timestamp && (
                <Row
                  label="Launch window"
                  value={formatDateTimeInLocationTz(
                    launch.launch_timestamp,
                    launch.timezone,
                  )}
                />
              )}
              {launch.summary && (
                <Row label="Summary" value={launch.summary} />
              )}
            </>
          )}
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
          {boat && <Row label="Boat" value={boat.name} />}
        </VStack>
      </Grid>
    </Box>
  )
}
