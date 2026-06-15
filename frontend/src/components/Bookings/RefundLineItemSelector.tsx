import { Badge, Box, Checkbox, HStack, Text, VStack } from "@chakra-ui/react"

import type { BookingItemPublic, BookingPublic } from "@/client"
import { formatCents } from "@/utils"

import {
  computeLineItemRefundCents,
  formatLineItemLabel,
  isRefundableLineItem,
  sumLineItemRefundCents,
} from "./refundLineItems"

export type RefundMode = "amount" | "items"

interface RefundLineItemSelectorProps {
  booking: BookingPublic
  selectedItemIds: string[]
  onSelectedItemIdsChange: (ids: string[]) => void
}

export function RefundLineItemSelector({
  booking,
  selectedItemIds,
  onSelectedItemIdsChange,
}: RefundLineItemSelectorProps) {
  const refundableItems = (booking.items ?? []).filter(isRefundableLineItem)

  const selectedItems = refundableItems.filter((item) =>
    selectedItemIds.includes(item.id),
  )
  const selectedTotal = sumLineItemRefundCents(selectedItems, booking)

  const toggleItem = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectedItemIdsChange([...selectedItemIds, itemId])
      return
    }
    onSelectedItemIdsChange(selectedItemIds.filter((id) => id !== itemId))
  }

  if (refundableItems.length === 0) {
    return (
      <Text fontSize="sm" color="text.muted">
        No refundable line items remain on this booking.
      </Text>
    )
  }

  return (
    <VStack align="stretch" gap={3}>
      <Text fontSize="sm" color="text.muted">
        Select line items to refund. Amount includes proportional tax (tip is
        not refunded).
      </Text>
      <VStack align="stretch" gap={2}>
        {refundableItems.map((item) => (
          <RefundLineItemRow
            key={item.id}
            item={item}
            booking={booking}
            checked={selectedItemIds.includes(item.id)}
            onCheckedChange={(checked) => toggleItem(item.id, checked)}
          />
        ))}
      </VStack>
      {selectedItemIds.length > 0 && (
        <HStack justify="space-between">
          <Text fontWeight="medium">Refund total</Text>
          <Text fontWeight="bold">${formatCents(selectedTotal)}</Text>
        </HStack>
      )}
    </VStack>
  )
}

interface RefundLineItemRowProps {
  item: BookingItemPublic
  booking: BookingPublic
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function RefundLineItemRow({
  item,
  booking,
  checked,
  onCheckedChange,
}: RefundLineItemRowProps) {
  const refundCents = computeLineItemRefundCents(item, booking)

  return (
    <Box
      p={3}
      borderWidth="1px"
      borderColor={checked ? "blue.300" : "border"}
      borderRadius="md"
    >
      <HStack justify="space-between" align="flex-start" gap={3}>
        <Checkbox.Root
          checked={checked}
          onCheckedChange={(e) => onCheckedChange(!!e.checked)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>
            <Text fontWeight="medium">{formatLineItemLabel(item)}</Text>
            {item.trip_merchandise_id && (
              <Text fontSize="xs" color="text.muted">
                Merchandise
              </Text>
            )}
          </Checkbox.Label>
        </Checkbox.Root>
        <Badge colorPalette="blue">${formatCents(refundCents)}</Badge>
      </HStack>
    </Box>
  )
}

interface RefundedItemsSummaryProps {
  booking: BookingPublic
}

export function RefundedItemsSummary({ booking }: RefundedItemsSummaryProps) {
  const refundedItems = (booking.items ?? []).filter(
    (item) =>
      (item.refunded_amount_cents ?? 0) > 0 ||
      (item.status ?? "").toLowerCase() === "refunded",
  )

  if (refundedItems.length === 0) {
    return null
  }

  return (
    <VStack align="stretch" gap={2} mt={2}>
      <Text fontWeight="medium" fontSize="sm">
        Refunded items
      </Text>
      {refundedItems.map((item) => (
        <Box key={item.id} fontSize="sm" color="text.muted">
          <HStack justify="space-between" align="flex-start">
            <Text>{formatLineItemLabel(item)}</Text>
            <Text fontWeight="medium" color="text.primary">
              ${formatCents(item.refunded_amount_cents ?? 0)}
            </Text>
          </HStack>
          {item.refund_reason && <Text>Reason: {item.refund_reason}</Text>}
          {item.refund_notes && <Text>Notes: {item.refund_notes}</Text>}
        </Box>
      ))}
    </VStack>
  )
}
