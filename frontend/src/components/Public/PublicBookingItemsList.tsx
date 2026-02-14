import { Box, HStack, Heading, Separator, Text, VStack } from "@chakra-ui/react"

import type { BookingItemPublic } from "@/client"
import { formatCents } from "@/utils"

interface PublicBookingItemsListProps {
  items: BookingItemPublic[]
  /** Section heading */
  heading?: string
  /** Optional muted heading style */
  headingColor?: string
  /** Styling: border, bg, etc. Passed to outer Box. */
  boxProps?: Record<string, unknown>
}

const formatItemType = (item: BookingItemPublic): string => {
  if (item.trip_merchandise_id) {
    const name = item.item_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return item.variant_option
      ? `Merchandise: ${name} – ${item.variant_option}`
      : `Merchandise: ${name}`
  }
  const type = item.item_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return `Ticket: ${type}`
}

export default function PublicBookingItemsList({
  items,
  heading = "Tickets & merchandise included",
  headingColor,
  boxProps = {},
}: PublicBookingItemsListProps) {
  if (!items?.length) return null

  const tickets = items.filter((i) => !i.trip_merchandise_id)
  const merchandise = items.filter((i) => i.trip_merchandise_id)

  const ItemRow = ({ item }: { item: BookingItemPublic }) => (
    <Box
      py={3}
      px={4}
      borderRadius="md"
      bg="bg.muted"
      borderWidth="1px"
      borderColor="border.subtle"
      className="print-ticket-item"
    >
      <HStack justify="space-between" align="start" gap={4}>
        <VStack align="start" gap={1}>
          <Text fontWeight="medium">{formatItemType(item)}</Text>
          <Text fontSize="sm" color="text.muted">
            {item.quantity} × ${formatCents(item.price_per_unit)} each
          </Text>
        </VStack>
        <VStack align="end" gap={1}>
          <Text fontWeight="bold">
            ${formatCents(item.quantity * item.price_per_unit)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  )

  return (
    <Box {...boxProps}>
      <Heading size="xl" mb={3} color={headingColor}>
        {heading}
      </Heading>
      <Separator mb={4} />
      <VStack gap={3} align="stretch">
        {tickets.length > 0 && (
          <>
            <Heading size="lg" fontWeight="medium" mb={2}>
              Tickets
            </Heading>
            <VStack gap={2} align="stretch">
              {tickets.map((item, index) => (
                <ItemRow key={item.id ?? `ticket-${index}`} item={item} />
              ))}
            </VStack>
          </>
        )}
        {tickets.length > 0 && merchandise.length > 0}
        {merchandise.length > 0 && (
          <>
            <Heading size="lg" fontWeight="medium" mb={2}>
              Merchandise
            </Heading>
            <VStack gap={2} align="stretch">
              {merchandise.map((item, index) => (
                <ItemRow key={item.id ?? `merch-${index}`} item={item} />
              ))}
            </VStack>
          </>
        )}
      </VStack>
    </Box>
  )
}
