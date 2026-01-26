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
  type TripPublic,
  TripsService,
} from "@/client"
import { fetchPublicLaunches, fetchPublicMissions, type PublicLaunch, type PublicMission } from "@/utils/publicApi"

import type { BookingStepData } from "../PublicBookingForm"

interface Step1TripSelectionProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
}

const Step1TripSelection = ({
  bookingData,
  updateBookingData,
  onNext,
}: Step1TripSelectionProps) => {
  // Fetch all trips with their details (using public endpoint)
  const { data: allTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["public-trips"],
    queryFn: () => TripsService.readPublicTrips({ limit: 100 }),
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

  const tripBoats: Array<{ boat_id: string }> = Array.isArray(tripBoatsResponse)
    ? tripBoatsResponse
    : []

  // Fetch boat names for display (using public endpoint)
  const { data: boatNames, isLoading: isLoadingBoatNames } = useQuery({
    queryKey: [
      "public-boat-names",
      tripBoats.map((tb: { boat_id: string }) => tb.boat_id),
    ],
    queryFn: async () => {
      if (!tripBoats || tripBoats.length === 0) return {}
      const names: Record<string, string> = {}
      await Promise.all(
        tripBoats.map(async (tripBoat: { boat_id: string }) => {
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

  // Helper functions to get related data
  const getTripMission = (tripId: string) => {
    const trip = allTrips?.data?.find((t: TripPublic) => t.id === tripId)
    return allMissions?.data?.find(
      (m: PublicMission) => m.id === trip?.mission_id,
    )
  }

  const getTripLaunch = (tripId: string) => {
    const mission = getTripMission(tripId)
    return allLaunches?.data?.find(
      (l: PublicLaunch) => l.id === mission?.launch_id,
    )
  }

  // Auto-select the first boat when boats are available
  React.useEffect(() => {
    if (
      bookingData.selectedTripId &&
      tripBoats &&
      tripBoats.length > 0 &&
      !bookingData.selectedBoatId
    ) {
      updateBookingData({ selectedBoatId: tripBoats[0].boat_id })
    }
  }, [
    bookingData.selectedTripId,
    tripBoats,
    bookingData.selectedBoatId,
    updateBookingData,
  ])

  const handleTripChange = (details: { value: string[] }) => {
    const tripId = details.value[0] || ""
    updateBookingData({ selectedTripId: tripId, selectedBoatId: "" })
  }

  const handleBoatChange = (details: { value: string[] }) => {
    const boatId = details.value[0] || ""
    updateBookingData({ selectedBoatId: boatId })
  }

  // Allow proceeding if trip is selected and either boat is explicitly selected OR there's only one boat available
  const canProceed =
    bookingData.selectedTripId &&
    (bookingData.selectedBoatId || (tripBoats && tripBoats.length === 1))

  // Filter trips to show only legitimate customer-facing experiences
  const activeTrips = React.useMemo(() => {
    if (!allTrips?.data || !allMissions?.data) return []

    return allTrips.data.filter((trip: TripPublic) => {
      // Trip must be active
      if (trip.active !== true) return false

      // Find the associated mission
      const mission = allMissions.data.find(
        (m: PublicMission) => m.id === trip.mission_id,
      )
      if (!mission) return false

      const isValid = mission.public === true

      return isValid
    })
  }, [allTrips?.data, allMissions?.data])

  // Create collection for trip selection with full context - only active trips
  const tripsCollection = createListCollection({
    items:
      activeTrips.map((trip: TripPublic) => {
        const mission = getTripMission(trip.id)
        const launch = getTripLaunch(trip.id)
        const departureDate = new Date(trip.departure_time)

        return {
          label: `${launch?.name || "Unknown Launch"} - ${
            mission?.name || "Unknown Mission"
          } - ${
            trip.type
          } (${departureDate.toLocaleDateString()} ${departureDate.toLocaleTimeString()})`,
          value: trip.id,
        }
      }) || [],
  })

  const boatsCollection = createListCollection({
    items:
      tripBoats?.map((tripBoat: { boat_id: string }) => ({
        label: boatNames?.[tripBoat.boat_id] || "Loading...",
        value: tripBoat.boat_id,
      })) || [],
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
                        const departureDate = new Date(trip.departure_time)
                        const label = `${launch?.name || "Unknown Launch"} - ${
                          mission?.name || "Unknown Mission"
                        } - ${
                          trip.type
                        } (${departureDate.toLocaleDateString()} ${departureDate.toLocaleTimeString()})`

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
                            {new Date(
                              selectedTrip.check_in_time,
                            ).toLocaleString()}
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontWeight="medium">Boarding:</Text>
                          <Text>
                            {new Date(
                              selectedTrip.boarding_time,
                            ).toLocaleString()}
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontWeight="medium">Departure:</Text>
                          <Text>
                            {new Date(
                              selectedTrip.departure_time,
                            ).toLocaleString()}
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
                            {tripBoats.map((tripBoat: { boat_id: string }) => (
                              <Select.Item
                                key={tripBoat.boat_id}
                                item={{
                                  value: tripBoat.boat_id,
                                  label:
                                    boatNames?.[tripBoat.boat_id] ||
                                    "Loading...",
                                }}
                              >
                                {boatNames?.[tripBoat.boat_id] || "Loading..."}
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
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
              updateBookingData({ selectedBoatId: tripBoats[0].boat_id })
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
