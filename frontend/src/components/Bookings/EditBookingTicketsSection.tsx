import {
  Badge,
  Box,
  Button,
  Card,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Controller, type Control } from "react-hook-form"

import type { UseMutationResult } from "@tanstack/react-query"
import type { BookingItemPublic, BookingPublic, BookingUpdate } from "@/client"
import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import { formatCents } from "@/utils"
import type { PendingBoatChange } from "./BoatChangeTypeDialog"
import { getItemTypeLabel, getTripName } from "./types"

interface BoatOption {
  boat_id: string
  name: string
}

interface EditBookingTicketsSectionProps {
  booking: BookingPublic
  boatsByTripId: Record<string, BoatOption[]>
  pricingByKey: Record<string, { ticket_type: string; price: number }[]>
  getTripNameForId: (tripId: string) => string
  getBoatName: (boatId: string) => string
  control: Control<BookingUpdate>
  watchedItemQuantities: { id: string; quantity: number }[] | null | undefined
  updateItemBoatMutation: UseMutationResult<
    BookingPublic,
    Error,
    { itemId: string; boatId: string; itemType?: string }
  >
  updateItemTypeMutation: UseMutationResult<
    BookingPublic,
    Error,
    { itemId: string; itemType: string }
  >
  setPendingBoatChange: (value: PendingBoatChange | null) => void
  setSelectedTicketTypeForBoatChange: (value: string) => void
  showErrorToast: (message: string) => void
  newTicketTripId: string
  newTicketBoatId: string
  newTicketType: string
  newTicketQty: number
  tripsForAddTicket: { id: string }[]
  boatsForNewTicket: BoatOption[]
  newTicketPricing: { ticket_type: string; price: number }[] | undefined
  onNewTicketTripIdChange: (value: string) => void
  onNewTicketBoatIdChange: (value: string) => void
  onNewTicketTypeChange: (value: string) => void
  onNewTicketQtyChange: (value: number) => void
  onAddTicket: () => void
  addTicketMutation: { isPending: boolean }
  getTripNameForAddTicket: (tripId: string) => string
}

export function EditBookingTicketsSection({
  booking,
  boatsByTripId,
  pricingByKey,
  getTripNameForId,
  getBoatName,
  control,
  watchedItemQuantities,
  updateItemBoatMutation,
  updateItemTypeMutation,
  setPendingBoatChange,
  setSelectedTicketTypeForBoatChange,
  showErrorToast,
  newTicketTripId,
  newTicketBoatId,
  newTicketType,
  newTicketQty,
  tripsForAddTicket,
  boatsForNewTicket,
  newTicketPricing,
  onNewTicketTripIdChange,
  onNewTicketBoatIdChange,
  onNewTicketTypeChange,
  onNewTicketQtyChange,
  onAddTicket,
  addTicketMutation,
  getTripNameForAddTicket,
}: EditBookingTicketsSectionProps) {
  const hasTickets = booking.items?.some((i) => !i.trip_merchandise_id)

  return (
    <Box w="full">
      <Text fontWeight="semibold" mb={3}>
        Tickets
      </Text>
      {hasTickets ? (
        <VStack gap={4} align="stretch">
          {booking.items?.map(
            (item, index) =>
              !item.trip_merchandise_id && (
                <Card.Root key={item.id} bg="bg.panel">
                  <Card.Header>
                    <Card.Title>{getTripNameForId(item.trip_id)}</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <VStack gap={4} align="stretch">
                      <SimpleGrid
                        columns={{ base: 1, md: 2 }}
                        gap={4}
                        w="full"
                      >
                        <Field label="Boat" w="full">
                          {(() => {
                            const boats = boatsByTripId[item.trip_id]
                            const canChangeBoat =
                              booking.booking_status !== "checked_in"
                            if (!boats?.length) {
                              return (
                                <Text>{getBoatName(item.boat_id)}</Text>
                              )
                            }
                            const updatingBoat =
                              updateItemBoatMutation.isPending &&
                              updateItemBoatMutation.variables?.itemId ===
                                item.id
                            return (
                              <NativeSelect
                                value={item.boat_id ?? ""}
                                disabled={!canChangeBoat || updatingBoat}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (!v || v === item.boat_id) return
                                  const newBoatName =
                                    boats.find((b) => b.boat_id === v)?.name ??
                                    v
                                  const ticketTypesForNewBoat =
                                    pricingByKey[`${item.trip_id}/${v}`]
                                  const hasCurrentType =
                                    ticketTypesForNewBoat?.some(
                                      (p) => p.ticket_type === item.item_type,
                                    )
                                  if (hasCurrentType) {
                                    updateItemBoatMutation.mutate({
                                      itemId: item.id,
                                      boatId: v,
                                    })
                                  } else if (ticketTypesForNewBoat?.length) {
                                    setPendingBoatChange({
                                      itemId: item.id,
                                      item,
                                      newBoatId: v,
                                      newBoatName,
                                      ticketTypeOptions: ticketTypesForNewBoat,
                                    })
                                    setSelectedTicketTypeForBoatChange(
                                      ticketTypesForNewBoat[0].ticket_type,
                                    )
                                  } else {
                                    showErrorToast(
                                      `Ticket types for boat "${newBoatName}" are not loaded yet. Try again.`,
                                    )
                                  }
                                }}
                              >
                                {boats.map((b) => (
                                  <option key={b.boat_id} value={b.boat_id}>
                                    {b.name}
                                  </option>
                                ))}
                              </NativeSelect>
                            )
                          })()}
                        </Field>
                        <Field label="Ticket type" w="full">
                          {(() => {
                            const key = `${item.trip_id}/${item.boat_id}`
                            const options = pricingByKey[key]
                            const canChangeType =
                              booking.booking_status !== "checked_in"
                            if (!options?.length) {
                              return (
                                <Text>
                                  {getItemTypeLabel(item.item_type)}
                                  {item.variant_option
                                    ? ` – ${item.variant_option}`
                                    : ""}
                                </Text>
                              )
                            }
                            const updating =
                              updateItemTypeMutation.isPending &&
                              updateItemTypeMutation.variables?.itemId ===
                                item.id
                            return (
                              <NativeSelect
                                value={item.item_type ?? ""}
                                disabled={!canChangeType || updating}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v && v !== item.item_type)
                                    updateItemTypeMutation.mutate({
                                      itemId: item.id,
                                      itemType: v,
                                    })
                                }}
                              >
                                {options.map((p) => (
                                  <option
                                    key={p.ticket_type}
                                    value={p.ticket_type}
                                  >
                                    {getItemTypeLabel(p.ticket_type)} (
                                    ${formatCents(p.price)})
                                  </option>
                                ))}
                              </NativeSelect>
                            )
                          })()}
                        </Field>
                      </SimpleGrid>
                      <SimpleGrid
                        columns={{ base: 1, sm: 2, md: 4 }}
                        gap={4}
                        alignItems="end"
                      >
                        <Field label="Quantity">
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
                                w="20"
                                value={
                                  field.value === undefined ||
                                  field.value === null
                                    ? item.quantity
                                    : field.value
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    Math.max(
                                      0,
                                      Number.parseInt(e.target.value, 10) ??
                                        0,
                                    ),
                                  )
                                }
                              />
                            )}
                          />
                        </Field>
                        <Field label="Price">
                          <Text>
                            ${formatCents(item.price_per_unit)}
                          </Text>
                        </Field>
                        <Field label="Total">
                          <Text fontWeight="medium">
                            $
                            {formatCents(
                              (watchedItemQuantities?.[index]?.quantity ??
                                item.quantity) * item.price_per_unit,
                            )}
                          </Text>
                        </Field>
                        <Field label="Status">
                          <Badge
                            size="sm"
                            colorPalette={
                              item.status === "active"
                                ? "green"
                                : item.status === "refunded" ||
                                    item.status === "cancelled"
                                  ? "red"
                                  : item.status === "fulfilled"
                                    ? "blue"
                                    : "gray"
                            }
                          >
                            {item.status}
                          </Badge>
                        </Field>
                      </SimpleGrid>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              ),
          )}
        </VStack>
      ) : (
        <Text color="text.muted" textAlign="center" py={2}>
          No tickets.
        </Text>
      )}
      {booking.booking_status !== "checked_in" && (
        <Card.Root mt={4} bg="bg.muted" borderStyle="dashed">
          <Card.Header>
            <Card.Title>Add ticket</Card.Title>
          </Card.Header>
          <Card.Body>
            <SimpleGrid
              columns={{ base: 1, sm: 2, md: 4 }}
              gap={4}
              alignItems="end"
            >
              <Field label="Trip" required>
                <NativeSelect
                  value={newTicketTripId}
                  onChange={(e) => {
                    onNewTicketTripIdChange(e.target.value)
                    onNewTicketBoatIdChange("")
                    onNewTicketTypeChange("")
                  }}
                >
                  <option value="">Select trip...</option>
                  {tripsForAddTicket.map((t) => (
                    <option key={t.id} value={t.id}>
                      {getTripNameForAddTicket(t.id)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Boat" required>
                <NativeSelect
                  value={newTicketBoatId}
                  onChange={(e) => {
                    onNewTicketBoatIdChange(e.target.value)
                    onNewTicketTypeChange("")
                  }}
                  disabled={!newTicketTripId}
                >
                  <option value="">Select boat...</option>
                  {boatsForNewTicket.map((b) => (
                    <option key={b.boat_id} value={b.boat_id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Ticket type" required>
                <NativeSelect
                  value={newTicketType}
                  onChange={(e) => onNewTicketTypeChange(e.target.value)}
                  disabled={!newTicketBoatId}
                >
                  <option value="">Select type...</option>
                  {newTicketPricing?.map((p) => (
                    <option key={p.ticket_type} value={p.ticket_type}>
                      {getItemTypeLabel(p.ticket_type)} (
                      ${formatCents(p.price)})
                    </option>
                  )) ?? []}
                </NativeSelect>
              </Field>
              <Field label="Quantity" required>
                <Input
                  type="number"
                  min={1}
                  value={newTicketQty}
                  onChange={(e) =>
                    onNewTicketQtyChange(
                      Math.max(
                        1,
                        Number.parseInt(e.target.value, 10) || 1,
                      ),
                    )
                  }
                />
              </Field>
            </SimpleGrid>
            <Button
              mt={4}
              onClick={onAddTicket}
              disabled={
                !newTicketTripId ||
                !newTicketBoatId ||
                !newTicketType ||
                newTicketQty < 1 ||
                addTicketMutation.isPending
              }
              loading={addTicketMutation.isPending}
            >
              Add ticket
            </Button>
          </Card.Body>
        </Card.Root>
      )}
    </Box>
  )
}
