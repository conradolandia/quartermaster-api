import {
  Badge,
  Flex,
  HStack,
  Icon,
  IconButton,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { FiCopy, FiMail, FiPhone } from "react-icons/fi"

import type { BookingPublic } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import { formatCents, formatDateTimeInLocationTz, parseApiDate } from "@/utils"
import {
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  getBookingStatusColor,
  getPaymentStatusColor,
  getRefundedCents,
  isPartiallyRefunded,
  totalTicketQuantity,
  tripTypeToLabel,
} from "./types"

interface BookingsTableRowProps {
  booking: BookingPublic
  boats: { id: string; name: string }[]
  archived: boolean
  userTz: string
  onCopyCode: (e: React.MouseEvent, code: string) => void
  onRowClick: (confirmationCode: string) => void
}

export default function BookingsTableRow({
  booking,
  boats,
  archived,
  userTz,
  onCopyCode,
  onRowClick,
}: BookingsTableRowProps) {
  const boatName =
    booking.items?.[0]?.boat_id
      ? boats.find((b) => b.id === booking.items?.[0]?.boat_id)?.name ?? "—"
      : "—"

  return (
    <Table.Row
      cursor="pointer"
      onClick={() => onRowClick(booking.confirmation_code)}
      opacity={archived ? 0.6 : 1}
      bg={archived ? "bg.muted" : undefined}
    >
      <Table.Cell w="28" minW="20">
        <Flex align="center" gap={2}>
          <Text
            fontFamily="mono"
            fontWeight="semibold"
            fontSize="sm"
            color="accent.default"
            title={booking.confirmation_code}
          >
            {booking.confirmation_code}
          </Text>
          <IconButton
            aria-label="Copy confirmation code"
            size="2xs"
            variant="ghost"
            onClick={(e) => onCopyCode(e, booking.confirmation_code)}
            title="Copy to clipboard"
          >
            <Icon as={FiCopy} boxSize={4} />
          </IconButton>
        </Flex>
      </Table.Cell>
      <Table.Cell w="52" minW="40">
        <VStack align="stretch" gap={0}>
          <Text fontSize="sm">
            {[booking.first_name, booking.last_name].filter(Boolean).join(" ")}
          </Text>
          <HStack gap={1}>
            <Icon as={FiMail} boxSize={3} color="text.muted" />
            <Text fontSize="sm" color="text.muted" title={booking.user_email}>
              {booking.user_email}
            </Text>
          </HStack>
          <HStack gap={1}>
            <Icon as={FiPhone} boxSize={3} color="text.muted" />
            <Text fontSize="sm" color="text.muted" title={booking.user_phone}>
              {booking.user_phone}
            </Text>
          </HStack>
        </VStack>
      </Table.Cell>
      <Table.Cell w="36" minW="28">
        {booking.mission_name || "N/A"}
      </Table.Cell>
      <Table.Cell w="32" minW="24">
        {booking.trip_name?.trim() ||
          (booking.trip_type
            ? tripTypeToLabel(booking.trip_type)
            : "N/A")}
      </Table.Cell>
      <Table.Cell w="24">
        {boatName}
      </Table.Cell>
      <Table.Cell w="52" minW="180px">
        <VStack align="start" gap={0}>
          <Text fontSize="sm" color="text.muted">
            Booking:{" "}
            <Badge
              size="xs"
              colorPalette={getBookingStatusColor(booking.booking_status || "")}
            >
              {formatBookingStatusLabel(booking.booking_status)}
            </Badge>
          </Text>
          {booking.payment_status && (
            <Text fontSize="sm" color="text.muted" whiteSpace="nowrap">
              Payment:{" "}
              {isPartiallyRefunded(booking) ? (
                <Badge size="xs" colorPalette="red">
                  {formatPaymentStatusLabel("partially_refunded")}
                </Badge>
              ) : (
                <Badge
                  size="xs"
                  colorPalette={getPaymentStatusColor(booking.payment_status)}
                >
                  {formatPaymentStatusLabel(booking.payment_status)}
                </Badge>
              )}
            </Text>
          )}
          {isPartiallyRefunded(booking) && (
            <Text fontSize="sm" color="text.muted">
              Refunded ${formatCents(getRefundedCents(booking))}
            </Text>
          )}
        </VStack>
      </Table.Cell>
      <Table.Cell w="20" minW="5rem" whiteSpace="nowrap">
        <Text fontWeight="bold">${formatCents(booking.total_amount)}</Text>
      </Table.Cell>
      <Table.Cell w="12" textAlign="center">
        {totalTicketQuantity(booking)}
      </Table.Cell>
      <Table.Cell w="36" minW="28">
        {formatDateTimeInLocationTz(booking.created_at, userTz) ||
          parseApiDate(booking.created_at).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
      </Table.Cell>
      <Table.Cell w="20" onClick={(e) => e.stopPropagation()}>
        <Flex justify="center">
          <BookingActionsMenu
            booking={booking}
            editDisabled={booking.booking_status === "checked_in"}
            archived={archived}
          />
        </Flex>
      </Table.Cell>
    </Table.Row>
  )
}
