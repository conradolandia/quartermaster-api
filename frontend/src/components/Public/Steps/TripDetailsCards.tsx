import {
  Card,
  Flex,
  Grid,
  Heading,
  Link,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import type * as React from "react"

import type { TripBoatPublicWithAvailability, TripPublic } from "@/client"

interface TripDetailsCardsProps {
  selectedTrip: TripPublic | null | undefined
  selectedLaunch: { launch_timestamp: string; timezone?: string | null } | null
  tripBoats: TripBoatPublicWithAvailability[]
  selectedBoatId: string
  formatTripTime: (dateString: string, timezone?: string | null) => string
  tripTypeToLabel: (type: string) => string
}

const DetailRow = ({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) => (
  <Flex
    direction={{ base: "column", sm: "row" }}
    justify={{ sm: "space-between" }}
    gap={{ base: 0, sm: 2 }}
    align={{ base: "stretch", sm: "center" }}
  >
    <Text fontWeight="medium" flexShrink={0}>
      {label}:
    </Text>
    <Text textAlign={{ base: "left", sm: "right" }} wordBreak="break-word">
      {value}
    </Text>
  </Flex>
)

function TripTimesCard({
  selectedTrip,
  selectedLaunch,
  formatTripTime,
  tripTypeToLabel,
}: {
  selectedTrip: TripPublic
  selectedLaunch: { launch_timestamp: string; timezone?: string | null } | null
  formatTripTime: (dateString: string, timezone?: string | null) => string
  tripTypeToLabel: (type: string) => string
}) {
  return (
    <Card.Root bg="bg.panel">
      <Card.Body>
        <Heading size="2xl" mb={3} fontWeight="200">
          Trip Details
        </Heading>
        <Separator mb={3} />
        <VStack align="stretch" gap={2}>
          <DetailRow
            label="Type"
            value={tripTypeToLabel(selectedTrip.type)}
          />
          <DetailRow
            label="Check-in"
            value={formatTripTime(
              selectedTrip.check_in_time,
              selectedTrip.timezone,
            )}
          />
          <DetailRow
            label="Boarding"
            value={formatTripTime(
              selectedTrip.boarding_time,
              selectedTrip.timezone,
            )}
          />
          <DetailRow
            label="Departure"
            value={formatTripTime(
              selectedTrip.departure_time,
              selectedTrip.timezone,
            )}
          />
          {selectedTrip.type === "launch_viewing" &&
            selectedLaunch?.launch_timestamp &&
            selectedLaunch?.timezone && (
              <DetailRow
                label="Launch time"
                value={formatTripTime(
                  selectedLaunch.launch_timestamp,
                  selectedLaunch.timezone,
                )}
              />
            )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

function BoatDepartureCard({
  tripBoats,
  selectedBoatId,
}: {
  tripBoats: TripBoatPublicWithAvailability[]
  selectedBoatId: string
}) {
  const selectedTb = tripBoats.find(
    (tb) => String(tb.boat_id) === String(selectedBoatId),
  )
  const boat = selectedTb?.boat

  return (
    <Card.Root bg="bg.panel">
      <Card.Body>
        <Heading size="2xl" mb={3} fontWeight="200">
          Boat & departure
        </Heading>
        <Separator mb={3} />
        {!selectedBoatId || !boat ? (
          <Text color="text.muted">
            Select a boat to see provider and departure location.
          </Text>
        ) : (
          <VStack
            align="stretch"
            gap={2}
            separator={<Separator mb={3} />}
          >
            {boat.provider?.name && (
              <DetailRow label="Provider" value={boat.provider.name} />
            )}
            <DetailRow label="Boat" value={boat.name} />
            {boat.provider?.address && (
              <DetailRow
                label="Departure location"
                value={
                  boat.provider.map_link ? (
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
                  )
                }
              />
            )}
          </VStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}

function TicketTypesCard({
  tripBoats,
  selectedBoatId,
}: {
  tripBoats: TripBoatPublicWithAvailability[]
  selectedBoatId: string
}) {
  if (!selectedBoatId || !tripBoats || tripBoats.length === 0) {
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
    (tb) => String(tb.boat_id) === String(selectedBoatId),
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
}

const TripDetailsCards = ({
  selectedTrip,
  selectedLaunch,
  tripBoats,
  selectedBoatId,
  formatTripTime,
  tripTypeToLabel,
}: TripDetailsCardsProps) => {
  if (!selectedTrip) return null

  return (
    <Grid
      templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
      gap={4}
      alignSelf="stretch"
    >
      <TripTimesCard
        selectedTrip={selectedTrip}
        selectedLaunch={selectedLaunch}
        formatTripTime={formatTripTime}
        tripTypeToLabel={tripTypeToLabel}
      />
      <BoatDepartureCard
        tripBoats={tripBoats}
        selectedBoatId={selectedBoatId}
      />
      <TicketTypesCard
        tripBoats={tripBoats}
        selectedBoatId={selectedBoatId}
      />
    </Grid>
  )
}

export default TripDetailsCards
