import { Box, HStack, Heading, Separator, Text, VStack } from "@chakra-ui/react"

import type { BookingItemPublic } from "@/client"
import { formatCents } from "@/utils"

interface PublicBookingItemsListProps {
  items: BookingItemPublic[]
  /** Section heading */
  heading?: string
  /** Optional muted heading style */
  headingColor?: string
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
    <Box>
      <Heading size="sm" mb={3} color={headingColor}>
        {heading}
      </Heading>
      <VStack gap={3} align="stretch">
        {tickets.length > 0 && (
          <>
            <Text fontSize="sm" fontWeight="medium" color="text.muted">
              Tickets
            </Text>
            <VStack gap={2} align="stretch">
              {tickets.map((item, index) => (
                <ItemRow key={item.id ?? `ticket-${index}`} item={item} />
              ))}
            </VStack>
          </>
        )}
        {tickets.length > 0 && merchandise.length > 0 && <Separator />}
        {merchandise.length > 0 && (
          <>
            <Text fontSize="sm" fontWeight="medium" color="text.muted">
              Merchandise
            </Text>
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
