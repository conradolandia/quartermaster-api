import { Badge, Input, Table, Text } from "@chakra-ui/react"
import { Controller, type Control } from "react-hook-form"

import type { BookingItemPublic, BookingUpdate } from "@/client"
import { Field } from "@/components/ui/field"
import { formatCents } from "@/utils"
import { getItemTypeLabel } from "./types"

interface EditBookingMerchandiseSectionProps {
  /** Full booking items; index matches item_quantity_updates */
  items: BookingItemPublic[]
  control: Control<BookingUpdate>
  watchedItemQuantities: { id: string; quantity: number }[] | null | undefined
  getTripNameForId: (tripId: string) => string
}

export function EditBookingMerchandiseSection({
  items,
  control,
  watchedItemQuantities,
  getTripNameForId,
}: EditBookingMerchandiseSectionProps) {
  const hasMerchandise = items.some((i) => i.trip_merchandise_id)

  if (!hasMerchandise) {
    return (
      <Text color="text.muted" textAlign="center" py={2}>
        No merchandise.
      </Text>
    )
  }

  return (
    <Table.Root size="xs" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Trip</Table.ColumnHeader>
          <Table.ColumnHeader>Type</Table.ColumnHeader>
          <Table.ColumnHeader>Qty</Table.ColumnHeader>
          <Table.ColumnHeader>Price</Table.ColumnHeader>
          <Table.ColumnHeader>Total</Table.ColumnHeader>
          <Table.ColumnHeader>Status</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map(
          (item, index) =>
            item.trip_merchandise_id && (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <Text>{getTripNameForId(item.trip_id)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text>
                    {getItemTypeLabel(item.item_type)}
                    {item.variant_option
                      ? ` – ${item.variant_option}`
                      : ""}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Controller
                    name={
                      `item_quantity_updates.${index}.quantity` as "item_quantity_updates.0.quantity"
                    }
                    control={control}
                    rules={{
                      min: { value: 0, message: "0 = remove" },
                    }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        w="16"
                        value={
                          field.value === undefined || field.value === null
                            ? item.quantity
                            : field.value
                        }
                        onChange={(e) =>
                          field.onChange(
                            Math.max(
                              0,
                              Number.parseInt(e.target.value, 10) ?? 0,
                            ),
                          )
                        }
                      />
                    )}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Text>${formatCents(item.price_per_unit)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text fontWeight="medium">
                    $
                    {formatCents(
                      (watchedItemQuantities?.[index]?.quantity ?? item.quantity) *
                        item.price_per_unit,
                    )}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="sm"
                    colorPalette={
                      item.status === "active"
                        ? "green"
                        : item.status === "refunded" || item.status === "cancelled"
                          ? "red"
                          : item.status === "fulfilled"
                            ? "blue"
                            : "gray"
                    }
                  >
                    {item.status}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ),
        )}
      </Table.Body>
    </Table.Root>
  )
}
