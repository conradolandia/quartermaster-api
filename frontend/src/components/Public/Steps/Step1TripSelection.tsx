import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Separator,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"

import type { TripPublic } from "@/client"

import type { BookingStepData } from "../bookingTypes"
import TripDetailsCards from "./TripDetailsCards"
import { useStep1Queries } from "./useStep1Queries"

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
  useDateFormatPreference()

  const {
    launches,
    allTrips,
    directLinkTrip,
    tripBoats,
    activeTrips,
    visibleLaunches,
    availableBoats,
    isLoadingLaunches,
    isLoadingTrips,
    isLoadingMissions,
    isLoadingBoats,
    isLoadingBoatNames,
    isTripSoldOut,
    canProceed,
    handleLaunchChange,
    handleTripChange,
    handleBoatChange,
    launchesCollection,
    tripsCollection,
    boatsCollection,
    formatTripTime,
    tripTypeToLabel,
    formatLaunchOptionLabel,
  } = useStep1Queries({ bookingData, updateBookingData, accessCode })

  const selectedTrip =
    (directLinkTrip && bookingData.selectedTripId === directLinkTrip.id
      ? directLinkTrip
      : null) ??
    allTrips?.data?.find(
      (t: TripPublic) => t.id === bookingData.selectedTripId,
    )

  const selectedLaunch = selectedTrip
    ? launches.find((l) => l.id === bookingData.selectedLaunchId) ?? null
    : null

  return (
    <VStack gap={6} align="stretch">
      <Card.Root bg="bg.panel">
        <Card.Body>
          <Heading size="5xl" mb={2} fontWeight="200">
            Select Experience
          </Heading>
          <Text color="text.muted" mb={8}>
            Choose your mission, then your trip and boat.
          </Text>
          <VStack align="stretch" gap={4}>
            {/* Mission Selection */}
            <Box>
              <Text fontWeight="medium" mb={2}>
                Mission
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
                      <Select.ValueText placeholder="Select a mission" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content
                      minWidth={{
                        base: "var(--reference-width)",
                        md: "400px",
                      }}
                    >
                      {visibleLaunches.map((launch) => {
                        const label = formatLaunchOptionLabel(launch)
                        return (
                          <Select.Item
                            key={launch.id}
                            item={{ value: launch.id, label }}
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

            {/* Trip Selection */}
            <Box>
              <Text fontWeight="medium" mb={2}>
                Trip
              </Text>
              {!bookingData.selectedLaunchId ? (
                <Text color="text.muted" fontSize="sm">
                  Select a mission to see available launch and pre-launch trips.
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
                    <Select.Content
                      minWidth={{
                        base: "var(--reference-width)",
                        md: "400px",
                      }}
                    >
                      {activeTrips.map((trip: TripPublic) => {
                        const label = `${trip.name?.trim() ? `${trip.name.trim()} - ` : ""}${tripTypeToLabel(trip.type)}`
                        return (
                          <Select.Item
                            key={trip.id}
                            item={{ value: trip.id, label }}
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

            {/* Sold Out */}
            {bookingData.selectedTripId && !isLoadingBoats && isTripSoldOut && (
              <Card.Root bg="red.50" borderColor="red.200" borderWidth="1px">
                <Card.Body>
                  <VStack gap={2}>
                    <Heading size="md" color="red.700">
                      This Trip Is Sold Out
                    </Heading>
                    <Text color="red.600" textAlign="center">
                      All boats for this trip are at full capacity. Please
                      select a different trip.
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>
            )}

            {/* Boat Selection */}
            {bookingData.selectedTripId &&
              !isTripSoldOut &&
              availableBoats.length > 1 && (
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
                          <Select.Content
                            minWidth={{
                              base: "var(--reference-width)",
                              md: "300px",
                            }}
                          >
                            {boatsCollection.items.map((item) => (
                              <Select.Item key={item.value} item={item}>
                                {item.label}
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

            {/* Trip Details (sold-out view) */}
            {bookingData.selectedTripId && isTripSoldOut && selectedTrip && (
              <Card.Root bg="bg.panel">
                <Card.Body>
                  <Heading size="2xl" mb={3} fontWeight="200">
                    Trip Details
                  </Heading>
                  <Separator mb={3} />
                  <VStack align="stretch" gap={2}>
                    {/* Minimal sold-out details */}
                    <Text>
                      {tripTypeToLabel(selectedTrip.type)} &mdash;{" "}
                      {formatTripTime(
                        selectedTrip.departure_time,
                        selectedTrip.timezone,
                      )}
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>
            )}

            {/* Trip Details, Boat & departure, Ticket types (three columns) */}
            {bookingData.selectedTripId && !isTripSoldOut && (
              <TripDetailsCards
                selectedTrip={selectedTrip}
                selectedLaunch={selectedLaunch}
                tripBoats={tripBoats}
                selectedBoatId={bookingData.selectedBoatId}
                formatTripTime={formatTripTime}
                tripTypeToLabel={tripTypeToLabel}
              />
            )}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Navigation */}
      <Flex justify="flex-end" pt={4} w={{ base: "100%", sm: "auto" }}>
        <Button
          colorPalette="blue"
          size={{ base: "lg", sm: "md" }}
          w={{ base: "100%", sm: "auto" }}
          onClick={() => {
            if (
              bookingData.selectedTripId &&
              !bookingData.selectedBoatId &&
              availableBoats.length > 0
            ) {
              const first = availableBoats[0]
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
      </Flex>
    </VStack>
  )
}

export default Step1TripSelection
