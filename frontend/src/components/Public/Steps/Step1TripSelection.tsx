import {
  Box,
  Button,
  Card,
  Grid,
  HStack,
  Heading,
  Link,
  Select,
  Separator,
  Spinner,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

import {
  BoatsService,
  LaunchesService,
  MissionsService,
  type TripBoatPublicWithAvailability,
  TripBoatsService,
  type TripPublic,
  TripsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatDateTimeNoSeconds,
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"

import type { BookingStepData } from "../PublicBookingForm"

interface Step1TripSelectionProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
  accessCode?: string | null
}

const Step1TripSelection = ({
  bookingData,
  updateBookingData,
  onNext,
  accessCode,
}: Step1TripSelectionProps) => {
  const { showErrorToast } = useCustomToast()

  // Fetch public launches (for Launch dropdown)
  const { data: launchesResponse, isLoading: isLoadingLaunches } = useQuery({
    queryKey: ["public-launches"],
    queryFn: () => LaunchesService.readPublicLaunches({ limit: 100 }),
  })

  // Fetch public missions (to filter trips by launch)
  const { data: missionsResponse, isLoading: isLoadingMissions } = useQuery({
    queryKey: ["public-missions"],
    queryFn: () => MissionsService.readPublicMissions({ limit: 500 }),
  })

  const launches = launchesResponse?.data ?? []
  const missions = missionsResponse?.data ?? []

  // Fetch all trips with their details (using public endpoint)
  const { data: allTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["public-trips", accessCode],
    queryFn: () =>
      TripsService.readPublicTrips({
        limit: 100,
        accessCode: accessCode || undefined,
      }),
  })

  // Direct-link / unlisted trip: fetch single trip by ID when selected (e.g. from URL); only use if available by date/launch (API 404s otherwise)
  const {
    data: directLinkTrip,
    isLoading: isLoadingDirectTrip,
    isError: isDirectLinkTripError,
  } = useQuery({
    queryKey: ["public-trip", bookingData.selectedTripId, accessCode],
    queryFn: () =>
      TripsService.readPublicTrip({
        tripId: bookingData.selectedTripId,
        accessCode: accessCode || undefined,
      }),
    enabled:
      !!bookingData.selectedTripId &&
      !!allTrips &&
      !allTrips.data?.some(
        (t: TripPublic) => t.id === bookingData.selectedTripId,
      ),
  })

  // When resuming a booking or direct link we have selectedTripId but may not have selectedLaunchId; derive it from the trip's mission
  React.useEffect(() => {
    if (!bookingData.selectedTripId || bookingData.selectedLaunchId || missions.length === 0)
      return
    const tripFromList = allTrips?.data?.find(
      (t: TripPublic) => t.id === bookingData.selectedTripId,
    )
    const trip = tripFromList ?? (directLinkTrip && bookingData.selectedTripId === directLinkTrip.id ? directLinkTrip : null)
    const mission = trip && missions.find((m: { id: string }) => m.id === trip.mission_id)
    if (mission) {
      updateBookingData({ selectedLaunchId: mission.launch_id })
    }
  }, [
    bookingData.selectedTripId,
    bookingData.selectedLaunchId,
    allTrips?.data,
    directLinkTrip,
    missions,
    updateBookingData,
  ])

  // Fetch trip boats for selected trip (using public endpoint)
  const { data: tripBoatsResponse, isLoading: isLoadingBoats } = useQuery({
    queryKey: ["public-trip-boats", bookingData.selectedTripId],
    queryFn: () =>
      TripBoatsService.readPublicTripBoatsByTrip({
        tripId: bookingData.selectedTripId,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  const tripBoats: TripBoatPublicWithAvailability[] = Array.isArray(
    tripBoatsResponse,
  )
    ? tripBoatsResponse
    : []

  // Fetch boat names for display (fallback when boat not in response)
  const { data: boatNames, isLoading: isLoadingBoatNames } = useQuery({
    queryKey: ["public-boat-names", tripBoats.map((tb) => tb.boat_id)],
    queryFn: async () => {
      if (!tripBoats || tripBoats.length === 0) return {}
      const names: Record<string, string> = {}
      await Promise.all(
        tripBoats.map(async (tripBoat) => {
          try {
            const boat = await BoatsService.readPublicBoat({
              boatId: tripBoat.boat_id,
            })
            names[tripBoat.boat_id] = boat.name
          } catch (error) {
            names[tripBoat.boat_id] = "Unknown Boat"
          }
        }),
      )
      return names
    },
    enabled: !!tripBoats && tripBoats.length > 0,
  })

  // Auto-select the first boat when boats are available and set remaining capacity
  React.useEffect(() => {
    if (
      bookingData.selectedTripId &&
      tripBoats &&
      tripBoats.length > 0 &&
      !bookingData.selectedBoatId
    ) {
      const first = tripBoats[0]
      updateBookingData({
        selectedBoatId: first.boat_id,
        boatRemainingCapacity: first.remaining_capacity,
      })
    }
  }, [
    bookingData.selectedTripId,
    tripBoats,
    bookingData.selectedBoatId,
    updateBookingData,
  ])

  // Keep boatRemainingCapacity in sync when selected boat or trip boats change; clear and notify when boat has no capacity
  React.useEffect(() => {
    if (!bookingData.selectedBoatId || !tripBoats?.length) return
    const selected = tripBoats.find(
      (tb) => String(tb.boat_id) === String(bookingData.selectedBoatId),
    )
    if (selected && selected.remaining_capacity <= 0) {
      showErrorToast(
        "This boat has no remaining capacity. Please choose another boat.",
      )
      updateBookingData({
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
      return
    }
    const remaining = selected?.remaining_capacity ?? null
    if (remaining !== bookingData.boatRemainingCapacity) {
      updateBookingData({ boatRemainingCapacity: remaining })
    }
  }, [
    bookingData.selectedBoatId,
    bookingData.boatRemainingCapacity,
    tripBoats,
    updateBookingData,
    showErrorToast,
  ])

  const handleLaunchChange = (details: { value: string[] }) => {
    const launchId = details.value[0] || ""
    updateBookingData({
      selectedLaunchId: launchId,
      selectedTripId: "",
      selectedBoatId: "",
      boatRemainingCapacity: null,
    })
  }

  const handleTripChange = (details: { value: string[] }) => {
    const tripId = details.value[0] || ""
    updateBookingData({
      selectedTripId: tripId,
      selectedBoatId: "",
      boatRemainingCapacity: null,
    })
  }

  const handleBoatChange = (details: { value: string[] }) => {
    const boatId = details.value[0] || ""
    const selected = tripBoats?.find(
      (tb) => String(tb.boat_id) === String(boatId),
    )
    updateBookingData({
      selectedBoatId: boatId,
      boatRemainingCapacity: selected?.remaining_capacity ?? null,
    })
  }

  // Mission IDs for the selected launch (used to filter trips)
  const missionIdsForLaunch = React.useMemo(() => {
    if (!bookingData.selectedLaunchId) return new Set<string>()
    return new Set(
      missions
        .filter(
          (m: { launch_id: string }) => m.launch_id === bookingData.selectedLaunchId,
        )
        .map((m: { id: string }) => m.id),
    )
  }, [bookingData.selectedLaunchId, missions])

  // Filter trips: only active trips, and only for the selected launch's missions; include direct-link (unlisted) trip when selected
  const activeTrips = React.useMemo(() => {
    const fromList = allTrips?.data ?? []
    const base = fromList.filter(
      (trip: TripPublic) =>
        trip.active === true &&
        (!bookingData.selectedLaunchId ||
          missionIdsForLaunch.has(trip.mission_id)),
    )
    if (
      directLinkTrip &&
      directLinkTrip.active === true &&
      (!bookingData.selectedLaunchId ||
        missionIdsForLaunch.has(directLinkTrip.mission_id)) &&
      !base.some((t: TripPublic) => t.id === directLinkTrip.id)
    ) {
      return [...base, directLinkTrip]
    }
    return base
  }, [
    allTrips?.data,
    directLinkTrip,
    bookingData.selectedLaunchId,
    missionIdsForLaunch,
  ])

  // Allow proceeding if launch and trip are selected and either boat is explicitly selected OR there's only one boat available
  const canProceed =
    bookingData.selectedLaunchId &&
    bookingData.selectedTripId &&
    (bookingData.selectedBoatId || (tripBoats && tripBoats.length === 1))

  // Launches in the future, sorted by launch_timestamp (soonest first)
  const sortedLaunches = React.useMemo(() => {
    const now = Date.now()
    return [...launches]
      .filter((a) => new Date(a.launch_timestamp).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.launch_timestamp).getTime() -
          new Date(b.launch_timestamp).getTime(),
      )
  }, [launches])

  // Only show launches that have at least one trip visible to the user (in allTrips or direct-link trip)
  const launchIdsWithVisibleTrips = React.useMemo(() => {
    const ids = new Set<string>()
    for (const trip of allTrips?.data ?? []) {
      const mission = missions.find((m: { id: string }) => m.id === trip.mission_id)
      if (mission?.launch_id) ids.add(mission.launch_id)
    }
    if (directLinkTrip) {
      const mission = missions.find((m: { id: string }) => m.id === directLinkTrip.mission_id)
      if (mission?.launch_id) ids.add(mission.launch_id)
    }
    return ids
  }, [allTrips?.data, directLinkTrip, missions])

  const visibleLaunches = React.useMemo(
    () => sortedLaunches.filter((l) => launchIdsWithVisibleTrips.has(l.id)),
    [sortedLaunches, launchIdsWithVisibleTrips],
  )

  // If the selected launch has passed or has no visible trips, clear launch/trip/boat and notify (defer to avoid flushSync during render)
  React.useEffect(() => {
    if (
      isLoadingLaunches ||
      isLoadingMissions ||
      isLoadingTrips ||
      !bookingData.selectedLaunchId ||
      visibleLaunches.some((l) => l.id === bookingData.selectedLaunchId)
    )
      return
    queueMicrotask(() => {
      showErrorToast(
        "The selected launch is no longer available. Please choose another.",
      )
      updateBookingData({
        selectedLaunchId: "",
        selectedTripId: "",
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
    })
  }, [
    bookingData.selectedLaunchId,
    visibleLaunches,
    updateBookingData,
    showErrorToast,
    isLoadingLaunches,
    isLoadingMissions,
    isLoadingTrips,
  ])

  // If the selected trip is not available for the selected launch (or inactive), or direct-link trip unavailable by date/launch, clear and notify (defer to avoid flushSync during render)
  React.useEffect(() => {
    if (
      isLoadingTrips ||
      isLoadingMissions ||
      isLoadingDirectTrip ||
      !bookingData.selectedTripId ||
      activeTrips.some((t: TripPublic) => t.id === bookingData.selectedTripId)
    )
      return
    const message = isDirectLinkTripError
      ? "This trip is no longer available. It may have already departed or the launch for this mission may have already occurred."
      : "The selected trip is not available for this launch. Please choose another."
    queueMicrotask(() => {
      showErrorToast(message)
      updateBookingData({
        selectedTripId: "",
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
    })
  }, [
    bookingData.selectedTripId,
    activeTrips,
    updateBookingData,
    showErrorToast,
    isLoadingTrips,
    isLoadingMissions,
    isLoadingDirectTrip,
    isDirectLinkTripError,
  ])

  // If the selected boat is not on this trip, clear boat and notify (capacity is handled in the sync effect above); defer to avoid flushSync during render
  React.useEffect(() => {
    if (
      !bookingData.selectedTripId ||
      !bookingData.selectedBoatId ||
      isLoadingBoats
    )
      return
    const selected = tripBoats.find(
      (tb) => String(tb.boat_id) === String(bookingData.selectedBoatId),
    )
    if (selected) return
    queueMicrotask(() => {
      showErrorToast(
        "The selected boat is not available for this trip. Please choose another.",
      )
      updateBookingData({
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
    })
  }, [
    bookingData.selectedTripId,
    bookingData.selectedBoatId,
    tripBoats,
    isLoadingBoats,
    updateBookingData,
    showErrorToast,
  ])

  const formatTripTime = (dateString: string, timezone?: string | null) => {
    const d = parseApiDate(dateString)
    const parts = timezone
      ? formatInLocationTimezoneWithAbbr(d, timezone)
      : null
    if (parts) return `${parts.dateTime} ${parts.timezoneAbbr}`
    return formatDateTimeNoSeconds(d)
  }

  const tripTypeToLabel = (type: string): string => {
    if (type === "launch_viewing") return "Launch Viewing"
    if (type === "pre_launch") return "Pre-Launch"
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatTripOptionLabel = (trip: TripPublic): string => {
    const readableType = tripTypeToLabel(trip.type)
    const time = formatTripTime(trip.departure_time, trip.timezone)
    if (trip.name?.trim()) {
      return `${trip.name.trim()} - ${readableType} (${time})`
    }
    return `${readableType} (${time})`
  }

  const formatLaunchOptionLabel = (launch: {
    name: string
    launch_timestamp: string
    timezone?: string | null
  }): string => {
    const dateStr = formatTripTime(launch.launch_timestamp, launch.timezone)
    return launch.name?.trim()
      ? `${launch.name.trim()} (${dateStr})`
      : dateStr
  }

  // Create collection for launch selection (only launches with visible trips)
  const launchesCollection = createListCollection({
    items: visibleLaunches.map((launch) => ({
      label: formatLaunchOptionLabel(launch),
      value: launch.id,
    })),
  })

  // Create collection for trip selection with full context - only active trips for selected launch
  const tripsCollection = createListCollection({
    items:
      activeTrips.map((trip: TripPublic) => ({
        label: formatTripOptionLabel(trip),
        value: trip.id,
      })) || [],
  })

  const boatsCollection = createListCollection({
    items:
      tripBoats
        ?.filter((tb) => tb.remaining_capacity > 0)
        .map((tripBoat: TripBoatPublicWithAvailability) => {
          const name =
            tripBoat.boat?.name || boatNames?.[tripBoat.boat_id] || "Loading..."
          return {
            label: `${name} (${tripBoat.remaining_capacity} spots left)`,
            value: tripBoat.boat_id,
          }
        }) || [],
  })

  return (
    <VStack gap={6} align="stretch">
      {/* Trip Selection */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <Heading size="5xl" mb={2} fontWeight="200">
            Select Experience
          </Heading>
          <Text color="text.muted" mb={8}>
            Choose your launch, then your trip and boat.
          </Text>
          <VStack align="stretch" gap={4}>
            {/* Launch Selection */}
            <Box>
              <Text fontWeight="medium" mb={2}>
                Launch
              </Text>
              {isLoadingLaunches ? (
                <Spinner size="sm" />
              ) : (
                <Select.Root
                  collection={launchesCollection}
                  value={
                    bookingData.selectedLaunchId
                      ? [bookingData.selectedLaunchId]
                      : []
                  }
                  onValueChange={handleLaunchChange}
                >
                  <Select.Control width="100%">
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select a launch" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content minWidth="400px">
                      {visibleLaunches.map((launch) => {
                        const label = formatLaunchOptionLabel(launch)
                        return (
                          <Select.Item
                            key={launch.id}
                            item={{
                              value: launch.id,
                              label,
                            }}
                          >
                            {label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        )
                      })}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              )}
            </Box>

            {/* Trip Selection - only when launch is selected */}
            <Box>
              <Text fontWeight="medium" mb={2}>
                Trip
              </Text>
              {!bookingData.selectedLaunchId ? (
                <Text color="text.muted" fontSize="sm">
                  Select a launch first to see available trips.
                </Text>
              ) : isLoadingTrips || isLoadingMissions ? (
                <Spinner size="sm" />
              ) : (
                <Select.Root
                  collection={tripsCollection}
                  value={
                    bookingData.selectedTripId
                      ? [bookingData.selectedTripId]
                      : []
                  }
                  onValueChange={handleTripChange}
                >
                  <Select.Control width="100%">
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select your rocket viewing experience" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content minWidth="400px">
                      {activeTrips.map((trip: TripPublic) => {
                        const label = formatTripOptionLabel(trip)
                        return (
                          <Select.Item
                            key={trip.id}
                            item={{
                              value: trip.id,
                              label,
                            }}
                          >
                            {label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        )
                      })}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              )}
            </Box>

            {/* Boat Selection - Only show if trip is selected and there are multiple boats */}
            {bookingData.selectedTripId &&
              tripBoats &&
              tripBoats.length > 1 && (
                <Card.Root bg="bg.panel">
                  <Card.Body>
                    <Heading size="2xl" mb={3} fontWeight="200">
                      Choose Your Boat
                    </Heading>
                    <Text color="text.muted" mb={6}>
                      Select your preferred vessel for this trip.
                    </Text>
                    {isLoadingBoats || isLoadingBoatNames ? (
                      <Spinner size="sm" />
                    ) : (
                      <Select.Root
                        collection={boatsCollection}
                        value={
                          bookingData.selectedBoatId
                            ? [bookingData.selectedBoatId]
                            : []
                        }
                        onValueChange={handleBoatChange}
                      >
                        <Select.Control width="100%">
                          <Select.Trigger>
                            <Select.ValueText placeholder="Select a boat" />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Select.Positioner>
                          <Select.Content minWidth="300px">
                            {tripBoats
                              .filter((tb) => tb.remaining_capacity > 0)
                              .map(
                                (tripBoat: TripBoatPublicWithAvailability) => {
                                  const name =
                                    tripBoat.boat?.name ||
                                    boatNames?.[tripBoat.boat_id] ||
                                    "Loading..."
                                  const label = `${name} (${tripBoat.remaining_capacity} spots left)`
                                  return (
                                    <Select.Item
                                      key={tripBoat.boat_id}
                                      item={{
                                        value: tripBoat.boat_id,
                                        label,
                                      }}
                                    >
                                      {label}
                                      <Select.ItemIndicator />
                                    </Select.Item>
                                  )
                                },
                              )}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    )}
                  </Card.Body>
                </Card.Root>
              )}

            {/* Trip Details, Boat & departure, and Ticket types in the same row */}
            {bookingData.selectedTripId && (
              <Grid
                templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
                gap={4}
                alignSelf="stretch"
              >
                <Card.Root bg="bg.panel">
                  <Card.Body>
                    <Heading size="2xl" mb={3} fontWeight="200">
                      Trip Details
                    </Heading>
                    <Separator mb={3} />
                    {(() => {
                      const selectedTrip =
                        (directLinkTrip && bookingData.selectedTripId === directLinkTrip.id
                          ? directLinkTrip
                          : null) ??
                        allTrips?.data?.find(
                          (t: TripPublic) => t.id === bookingData.selectedTripId,
                        )
                      const selectedLaunch = selectedTrip
                        ? launches.find(
                            (l) => l.id === bookingData.selectedLaunchId,
                          )
                        : null
                      if (!selectedTrip) return null
                      return (
                        <VStack align="stretch" gap={2}>
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Type:</Text>
                            <Text>{tripTypeToLabel(selectedTrip.type)}</Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Check-in:</Text>
                            <Text>
                              {formatTripTime(
                                selectedTrip.check_in_time,
                                selectedTrip.timezone,
                              )}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Boarding:</Text>
                            <Text>
                              {formatTripTime(
                                selectedTrip.boarding_time,
                                selectedTrip.timezone,
                              )}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Departure:</Text>
                            <Text>
                              {formatTripTime(
                                selectedTrip.departure_time,
                                selectedTrip.timezone,
                              )}
                            </Text>
                          </HStack>
                          {selectedTrip.type === "launch_viewing" &&
                            selectedLaunch?.launch_timestamp &&
                            selectedLaunch?.timezone && (
                              <HStack justify="space-between">
                                <Text fontWeight="medium">Launch time:</Text>
                                <Text>
                                  {formatTripTime(
                                    selectedLaunch.launch_timestamp,
                                    selectedLaunch.timezone,
                                  )}
                                </Text>
                              </HStack>
                            )}
                        </VStack>
                      )
                    })()}
                  </Card.Body>
                </Card.Root>

                {/* Boat & departure: Provider, Boat, Departure location */}
                <Card.Root bg="bg.panel">
                  <Card.Body>
                    <Heading size="2xl" mb={3} fontWeight="200">
                      Boat & departure
                    </Heading>
                    <Separator mb={3} />
                    {(() => {
                      if (
                        !bookingData.selectedBoatId ||
                        !tripBoats ||
                        tripBoats.length === 0
                      ) {
                        return (
                          <Text color="text.muted">
                            Select a boat to see provider and departure
                            location.
                          </Text>
                        )
                      }
                      const selectedTb = tripBoats.find(
                        (tb) =>
                          String(tb.boat_id) ===
                          String(bookingData.selectedBoatId),
                      )
                      const boat = selectedTb?.boat
                      if (!boat) {
                        return (
                          <Text color="text.muted">
                            Select a boat to see provider and departure
                            location.
                          </Text>
                        )
                      }
                      return (
                        <VStack align="stretch" gap={2}>
                          {boat.provider?.name && (
                            <HStack justify="space-between">
                              <Text fontWeight="medium">Provider:</Text>
                              <Text>{boat.provider.name}</Text>
                            </HStack>
                          )}
                          <Separator mb={3} />
                          <HStack justify="space-between">
                            <Text fontWeight="medium">Boat:</Text>
                            <Text>{boat.name}</Text>
                          </HStack>
                          <Separator mb={3} />
                          {boat.provider?.address && (
                            <HStack justify="space-between">
                              <Text fontWeight="medium">
                                Departure location:
                              </Text>
                              <Text textAlign="right" flex={1} minW={0}>
                                {boat.provider.map_link ? (
                                  <Link
                                    href={boat.provider.map_link}
                                    target="_blank"
                                    colorPalette="blue"
                                    rel="noopener noreferrer"
                                  >
                                    {boat.provider.address}
                                  </Link>
                                ) : (
                                  boat.provider.address
                                )}
                              </Text>
                            </HStack>
                          )}
                        </VStack>
                      )
                    })()}
                  </Card.Body>
                </Card.Root>

                {/* Ticket types: placeholder when no boat, or list when boat selected */}
                {(() => {
                  if (
                    !bookingData.selectedBoatId ||
                    !tripBoats ||
                    tripBoats.length === 0
                  ) {
                    return (
                      <Card.Root bg="bg.panel">
                        <Card.Body>
                          <Heading size="2xl" mb={3} fontWeight="200">
                            Ticket types
                          </Heading>
                          <Text color="text.muted">
                            Select a boat to see ticket types and pricing.
                          </Text>
                        </Card.Body>
                      </Card.Root>
                    )
                  }
                  const selectedTb = tripBoats.find(
                    (tb) =>
                      String(tb.boat_id) === String(bookingData.selectedBoatId),
                  )
                  const pricing = selectedTb?.pricing
                  if (!pricing || pricing.length === 0) {
                    return (
                      <Card.Root bg="bg.panel">
                        <Card.Body>
                          <Heading size="2xl" mb={3} fontWeight="200">
                            Ticket types
                          </Heading>
                          <Text fontSize="sm" color="text.muted">
                            No ticket types available for this boat.
                          </Text>
                        </Card.Body>
                      </Card.Root>
                    )
                  }
                  return (
                    <Card.Root bg="bg.panel">
                      <Card.Body>
                        <Heading size="2xl" mb={3} fontWeight="200">
                          Ticket types
                        </Heading>
                        <Separator mb={3} />
                        <VStack align="stretch" gap={1}>
                          {pricing.map((p) => (
                            <Text key={p.ticket_type} fontSize="lg">
                              {p.ticket_type.replace(/_/g, " ")}: $
                              {(p.price / 100).toFixed(2)} ({p.remaining} left)
                            </Text>
                          ))}
                        </VStack>
                      </Card.Body>
                    </Card.Root>
                  )
                })()}
              </Grid>
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Navigation */}
      <HStack justify="flex-end" pt={4}>
        <Button
          colorPalette="blue"
          onClick={() => {
            // Ensure boat is selected before proceeding
            if (
              bookingData.selectedTripId &&
              !bookingData.selectedBoatId &&
              tripBoats &&
              tripBoats.length > 0
            ) {
              const first = tripBoats[0]
              updateBookingData({
                selectedBoatId: first.boat_id,
                boatRemainingCapacity: first.remaining_capacity,
              })
            }
            onNext()
          }}
          disabled={!canProceed}
        >
          Continue to Items
        </Button>
      </HStack>
    </VStack>
  )
}

export default Step1TripSelection
