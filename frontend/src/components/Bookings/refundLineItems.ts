import type { BookingItemPublic, BookingPublic } from "@/client"

export type RefundMode = "amount" | "items"

/** Item statuses that can be selected for a line-item refund. */
export const REFUNDABLE_ITEM_STATUSES = new Set(["active", "fulfilled"])

export function isRefundableLineItem(item: BookingItemPublic): boolean {
  return REFUNDABLE_ITEM_STATUSES.has((item.status ?? "active").toLowerCase())
}

/**
 * Refund for one line item: proportional share of discount and tax (no tip).
 * Mirrors backend compute_line_item_refund_cents.
 */
export function computeLineItemRefundCents(
  item: Pick<BookingItemPublic, "price_per_unit" | "quantity">,
  booking: Pick<BookingPublic, "subtotal" | "discount_amount" | "tax_amount">,
): number {
  const itemSubtotal = (item.price_per_unit ?? 0) * (item.quantity ?? 0)
  if (itemSubtotal <= 0 || (booking.subtotal ?? 0) <= 0) {
    return 0
  }

  const afterDiscountSubtotal = Math.max(
    0,
    (booking.subtotal ?? 0) - (booking.discount_amount ?? 0),
  )
  const itemAfterDiscount = Math.round(
    (itemSubtotal * afterDiscountSubtotal) / (booking.subtotal ?? 1),
  )
  if (afterDiscountSubtotal <= 0) {
    return itemAfterDiscount
  }

  const itemTax = Math.round(
    ((booking.tax_amount ?? 0) * itemAfterDiscount) / afterDiscountSubtotal,
  )
  return itemAfterDiscount + itemTax
}

export function sumLineItemRefundCents(
  items: BookingItemPublic[],
  booking: BookingPublic,
): number {
  return items.reduce(
    (sum, item) => sum + computeLineItemRefundCents(item, booking),
    0,
  )
}

export function formatLineItemLabel(item: BookingItemPublic): string {
  const typeLabel = (item.item_type ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const variant = item.variant_option ? ` – ${item.variant_option}` : ""
  return `${item.quantity}x ${typeLabel}${variant}`
}
