import {
  Badge,
  Box,
  Flex,
  Link,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"

import type {
  TripBoatPublicWithAvailability,
  TripWithStats,
} from "@/client"
import TripActionsMenu from "@/components/Common/TripActionsMenu"
import { formatCents, formatInLocationTimezoneWithAbbr, parseApiDate } from "@/utils"
import { seatsTakenFromTripBoat } from "./types"

interface TripsTableRowProps {
  trip: TripWithStats
  missionName: string
  boats: TripBoatPublicWithAvailability[]
  isPlaceholderData: boolean
}

function renderDepartureCell(
  departureTime: string,
  timezone?: string | null,
) {
  const d = parseApiDate(departureTime)
  if (Number.isNaN(d.getTime())) return <Text fontSize="sm">—</Text>
  const parts = timezone
    ? formatInLocationTimezoneWithAbbr(d, timezone)
    : null
  if (parts) {
    return (
      <Text fontSize="sm">
        {parts.dateTime} {parts.timezoneAbbr}
      </Text>
    )
  }
  return (
    <Text fontSize="sm">
      {d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Text>
  )
}

export default function TripsTableRow({
  trip,
  missionName,
  boats,
  isPlaceholderData,
}: TripsTableRowProps) {
  return (
    <Table.Row
      opacity={isPlaceholderData ? 0.5 : trip.archived ? 0.6 : 1}
      bg={trip.archived ? "bg.muted" : undefined}
    >
      <Table.Cell minW="8rem" px={1} pl={3} verticalAlign="top">
        <Link
          asChild
          color="dark.accent.primary"
          _hover={{ textDecoration: "underline" }}
        >
          <RouterLink to="/bookings" search={{ tripId: trip.id }}>
            <Text fontSize="sm" fontWeight="500" as="span">
              {trip.name || "—"}
            </Text>
          </RouterLink>
        </Link>
      </Table.Cell>
      <Table.Cell minW="6rem" px={1} verticalAlign="top">
        {trip.type === "launch_viewing"
          ? "Launch Viewing"
          : "Pre-Launch"}
      </Table.Cell>
      <Table.Cell minW="6rem" px={1} verticalAlign="top">
        {missionName || "Unknown"}
      </Table.Cell>
      <Table.Cell minW="8rem" px={1} verticalAlign="top">
        {renderDepartureCell(trip.departure_time, trip.timezone)}
      </Table.Cell>
      <Table.Cell
        minW="3rem"
        px={1}
        verticalAlign="top"
        textAlign="center"
      >
        {boats != null && boats.length > 0
          ? boats.reduce((sum, tb) => {
              const used = seatsTakenFromTripBoat(tb)
              return sum + used
            }, 0)
          : 0}
      </Table.Cell>
      <Table.Cell minW="4rem" px={1} verticalAlign="top">
        ${formatCents((trip as TripWithStats).total_sales ?? 0)}
      </Table.Cell>
      <Table.Cell minW="6rem" px={1} verticalAlign="top">
        {boats != null && boats.length > 0 ? (
          <VStack align="stretch" gap={2}>
            {boats.map((tb) => {
              const used = seatsTakenFromTripBoat(tb)
              const maxCap = tb.max_capacity
              const remaining = Math.max(0, maxCap - used)
              const name = tb.boat?.name ?? "Boat"
              return (
                <Box key={tb.boat_id}>
                  <Text fontSize="sm">{name}</Text>
                  <Text
                    fontSize="sm"
                    color="gray.400"
                    mt={0.5}
                    lineHeight="1"
                  >
                    {used} of {maxCap} seats taken (
                    {remaining} remaining)
                  </Text>
                </Box>
              )
            })}
          </VStack>
        ) : (
          <Text fontSize="sm" color="gray.400">
            No boats assigned to this trip yet.
          </Text>
        )}
      </Table.Cell>
      <Table.Cell
        minW="4.5rem"
        px={1}
        py={5}
        verticalAlign="top"
        textAlign="center"
      >
        <Flex
          justify="center"
          align="center"
          gap={1}
          flexWrap="wrap"
        >
          <Badge
            colorPalette={
              (trip.booking_mode ?? "private") === "public"
                ? "blue"
                : (trip.booking_mode ?? "private") === "early_bird"
                  ? "purple"
                  : "gray"
            }
          >
            {(trip.booking_mode ?? "private") === "public"
              ? "Public"
              : (trip.booking_mode ?? "private") === "early_bird"
                ? "Early Bird"
                : "Private"}
          </Badge>
          <Badge
            colorPalette={trip.unlisted ? "orange" : "green"}
            size="sm"
          >
            {trip.unlisted ? "Unlisted" : "Listed"}
          </Badge>
        </Flex>
      </Table.Cell>
      <Table.Cell
        minW="4.5rem"
        px={1}
        py={5}
        verticalAlign="top"
        textAlign="center"
      >
        <Flex justify="center">
          <Badge
            colorPalette={
              (trip as TripWithStats).archived
                ? "gray"
                : trip.active
                  ? "green"
                  : "red"
            }
          >
            {(trip as TripWithStats).archived
              ? "Archived"
              : trip.active
                ? "Active"
                : "Inactive"}
          </Badge>
        </Flex>
      </Table.Cell>
      <Table.Cell minW="5rem" px={1} py={3} verticalAlign="top">
        <Flex justify="center">
          <TripActionsMenu trip={trip} />
        </Flex>
      </Table.Cell>
    </Table.Row>
  )
}
