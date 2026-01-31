import {
  Box,
  Button,
  Card,
  HStack,
  Heading,
  Select,
  Spinner,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

import {
  BoatsService,
  TripBoatsService,
  type TripBoatPublicWithAvailability,
  type TripPublic,
  TripsService,
} from "@/client"
import {
  formatDateTimeNoSeconds,
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"
import { fetchPublicLaunches, fetchPublicMissions, type PublicLaunch, type PublicMission } from "@/utils/publicApi"

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
  // Fetch all trips with their details (using public endpoint)
  const { data: allTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["public-trips", accessCode],
    queryFn: () =>
      TripsService.readPublicTrips({
        limit: 100,
        accessCode: accessCode || undefined,
      }),
  })

  // Fetch all missions to get mission details
  const { data: allMissions } = useQuery({
    queryKey: ["public-missions"],
    queryFn: () => fetchPublicMissions({ limit: 100 }),
  })

  // Fetch all launches to get launch details
  const { data: allLaunches } = useQuery({
    queryKey: ["public-launches"],
    queryFn: () => fetchPublicLaunches({ limit: 100 }),
  })

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

  // Helper functions to get related data (normalize IDs to string for comparison)
  const getTripMission = (tripId: string) => {
    const trip = allTrips?.data?.find(
      (t: TripPublic) => String(t.id) === String(tripId),
    )
    if (!trip?.mission_id) return undefined
    return allMissions?.data?.find(
      (m: PublicMission) => String(m.id) === String(trip.mission_id),
    )
  }

  const getTripLaunch = (tripId: string) => {
    const mission = getTripMission(tripId)
    if (!mission?.launch_id) return undefined
    return allLaunches?.data?.find(
      (l: PublicLaunch) => String(l.id) === String(mission.launch_id),
    )
  }

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

  // Keep boatRemainingCapacity in sync when selected boat or trip boats change
  React.useEffect(() => {
    if (!bookingData.selectedBoatId || !tripBoats?.length) return
    const selected = tripBoats.find(
      (tb) => String(tb.boat_id) === String(bookingData.selectedBoatId),
    )
    if (selected && selected.remaining_capacity <= 0) {
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
  ])

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
    const selected = tripBoats?.find((tb) => String(tb.boat_id) === String(boatId))
    updateBookingData({
      selectedBoatId: boatId,
      boatRemainingCapacity: selected?.remaining_capacity ?? null,
    })
  }

  // Allow proceeding if trip is selected and either boat is explicitly selected OR there's only one boat available
  const canProceed =
    bookingData.selectedTripId &&
    (bookingData.selectedBoatId || (tripBoats && tripBoats.length === 1))

  // Filter trips to show only active trips
  // Note: The backend already filters trips based on booking_mode and access_code,
  // so we only need to ensure trips are active here
  const activeTrips = React.useMemo(() => {
    if (!allTrips?.data) return []

    return allTrips.data.filter((trip: TripPublic) => {
      // Trip must be active
      return trip.active === true
    })
  }, [allTrips?.data])

  const formatTripTime = (dateString: string, timezone?: string | null) => {
    const d = parseApiDate(dateString)
    const parts = timezone ? formatInLocationTimezoneWithAbbr(d, timezone) : null
    if (parts) return `${parts.dateTime} ${parts.timezoneAbbr}`
    return formatDateTimeNoSeconds(d)
  }

  // Create collection for trip selection with full context - only active trips
  const tripsCollection = createListCollection({
    items:
      activeTrips.map((trip: TripPublic) => {
        const mission = getTripMission(trip.id)
        const launch = getTripLaunch(trip.id)
        return {
          label: `${launch?.name || "Unknown Launch"} - ${
            mission?.name || "Unknown Mission"
          } - ${trip.type} (${formatTripTime(trip.departure_time, trip.timezone)})`,
          value: trip.id,
        }
      }) || [],
  })

  const boatsCollection = createListCollection({
    items:
      tripBoats
        ?.filter((tb) => tb.remaining_capacity > 0)
        .map((tripBoat: TripBoatPublicWithAvailability) => {
          const name =
            tripBoat.boat?.name ||
            boatNames?.[tripBoat.boat_id] ||
            "Loading..."
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
          <Heading size="lg" mb={4}>
            Select Experience
          </Heading>
          <Text color="text.muted" mb={6}>
            Choose your preferred rocket launch viewing experience.
          </Text>
          <VStack align="stretch" gap={4}>
            <Box>
              {isLoadingTrips ? (
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
                        const mission = getTripMission(trip.id)
                        const launch = getTripLaunch(trip.id)
                        const label = `${launch?.name || "Unknown Launch"} - ${
                          mission?.name || "Unknown Mission"
                        } - ${trip.type} (${formatTripTime(trip.departure_time, trip.timezone)})`

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

            {/* Show trip details after selection */}
            {bookingData.selectedTripId && (
              <Card.Root bg="bg.panel">
                <Card.Body>
                  <Heading size="sm" mb={3}>
                    Trip Details
                  </Heading>
                  {(() => {
                    const selectedTrip = allTrips?.data?.find(
                      (t: TripPublic) => t.id === bookingData.selectedTripId,
                    )
                    // Mission and launch data available via helper functions if needed

                    if (!selectedTrip) return null

                    return (
                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text fontWeight="medium">Type:</Text>
                          <Text>{selectedTrip.type}</Text>
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
                      </VStack>
                    )
                  })()}
                </Card.Body>
              </Card.Root>
            )}

            {/* Boat Selection - Only show if trip is selected and there are multiple boats */}
            {bookingData.selectedTripId &&
              tripBoats &&
              tripBoats.length > 1 && (
                <Card.Root bg="bg.panel">
                  <Card.Body>
                    <Heading size="sm" mb={4}>
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
                              .map((tripBoat: TripBoatPublicWithAvailability) => {
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
                              })}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    )}
                  </Card.Body>
                </Card.Root>
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
