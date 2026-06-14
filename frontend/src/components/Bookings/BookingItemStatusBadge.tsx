import { Badge } from "@chakra-ui/react"

import type { BookingItemPublic, BookingPublic } from "@/client"

import {
  formatEffectiveItemStatusLabel,
  getEffectiveItemStatus,
  getEffectiveItemStatusColor,
} from "./types"

interface BookingItemStatusBadgeProps {
  booking: Pick<BookingPublic, "booking_status" | "payment_status">
  item: Pick<BookingItemPublic, "status">
  size?: "sm" | "md" | "lg"
}

export function BookingItemStatusBadge({
  booking,
  item,
  size,
}: BookingItemStatusBadgeProps) {
  const status = getEffectiveItemStatus(booking, item)
  return (
    <Badge size={size} colorPalette={getEffectiveItemStatusColor(status)}>
      {formatEffectiveItemStatusLabel(status)}
    </Badge>
  )
}
