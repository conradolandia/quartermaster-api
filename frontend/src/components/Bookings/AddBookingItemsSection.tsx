import {
  Button,
  HStack,
  IconButton,
  Input,
  Select,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import type { Dispatch, SetStateAction } from "react"
import { FiPlus, FiTrash2 } from "react-icons/fi"

import type { EffectivePricingItem } from "@/client"
import { formatCents } from "@/utils"

export interface TripMerchandiseItem {
  id: string
  name: string
  price: number
  quantity_available: number
  variant_options?: string | null
}

export interface SelectedItem {
  trip_id: string
  item_type: string
  quantity: number
  price_per_unit: number
  merchandise_id?: string
  variant_option?: string
}

interface AddBookingItemsSectionProps {
  tripPricing: EffectivePricingItem[]
  tripMerchandise: TripMerchandiseItem[]
  selectedItems: SelectedItem[]
  merchandiseVariantByKey: Record<string, string>
  addTicketItem: (ticketType: string) => void
  addMerchandiseItem: (merchandiseId: string, variantOption?: string) => void
  variantOptionsList: (opts: string | null | undefined) => string[]
  ticketCapacityReachedForType: (ticketType: string) => boolean
  getItemDisplayName: (item: SelectedItem) => string
  updateItemQuantity: (index: number, quantity: number) => void
  removeItem: (index: number) => void
  setMerchandiseVariantByKey: Dispatch<
    SetStateAction<Record<string, string>>
  >
}

export function AddBookingItemsSection({
  tripPricing,
  tripMerchandise,
  selectedItems,
  merchandiseVariantByKey,
  addTicketItem,
  addMerchandiseItem,
  variantOptionsList,
  ticketCapacityReachedForType,
  getItemDisplayName,
  updateItemQuantity,
  removeItem,
  setMerchandiseVariantByKey,
}: AddBookingItemsSectionProps) {
  return (
    <VStack gap={4} width="100%">
      <Text fontWeight="bold">Select Items</Text>

      {tripPricing.length > 0 && (
        <VStack
          gap={2}
          width="100%"
          p={3}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
        >
          <Text fontWeight="medium">Tickets</Text>
          <HStack gap={2} flexWrap="wrap">
            {tripPricing.map((pricing) => (
              <Button
                key={pricing.ticket_type}
                size="sm"
                variant="outline"
                disabled={ticketCapacityReachedForType(pricing.ticket_type)}
                onClick={() => addTicketItem(pricing.ticket_type)}
              >
                <FiPlus style={{ marginRight: "4px" }} />
                {pricing.ticket_type
                  .replace("_", " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
                - ${formatCents(pricing.price)}
                {pricing.remaining >= 0 && (
                  <> ({pricing.remaining} left)</>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>
      )}

      {tripMerchandise.length > 0 && (
        <VStack
          gap={2}
          width="100%"
          p={3}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
        >
          <Text fontWeight="medium">Merchandise</Text>
          <VStack gap={2} align="stretch">
            {tripMerchandise.map((merchandise) => {
              const options = variantOptionsList(merchandise.variant_options)
              const hasVariants = options.length > 0
              const selectedVariant =
                merchandiseVariantByKey[merchandise.id] ?? options[0]
              return (
                <HStack
                  key={merchandise.id}
                  gap={2}
                  align="center"
                  flexWrap="wrap"
                >
                  <Text fontSize="sm">
                    {merchandise.name} - ${formatCents(merchandise.price)} (
                    {merchandise.quantity_available} available)
                  </Text>
                  {hasVariants && (
                    <Select.Root
                      size="sm"
                      width="min(100px, 20vw)"
                      value={[selectedVariant]}
                      onValueChange={(e) =>
                        setMerchandiseVariantByKey((prev) => ({
                          ...prev,
                          [merchandise.id]: e.value[0] ?? "",
                        }))
                      }
                      collection={createListCollection({
                        items: options.map((o) => ({
                          label: o,
                          value: o,
                        })),
                      })}
                    >
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Variant" />
                        </Select.Trigger>
                      </Select.Control>
                      <Select.Positioner>
                        <Select.Content>
                          {options.map((o) => (
                            <Select.Item
                              key={o}
                              item={{ label: o, value: o }}
                            >
                              {o}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addMerchandiseItem(
                        merchandise.id,
                        hasVariants ? selectedVariant : undefined,
                      )
                    }
                    disabled={
                      merchandise.quantity_available <= 0 ||
                      (hasVariants && !selectedVariant)
                    }
                  >
                    <FiPlus style={{ marginRight: "4px" }} />
                    Add
                  </Button>
                </HStack>
              )
            })}
          </VStack>
        </VStack>
      )}

      {selectedItems.length > 0 && (
        <VStack
          gap={2}
          width="100%"
          p={3}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
        >
          <Text fontWeight="medium">Selected Items</Text>
          {selectedItems.map((item, index) => (
            <HStack
              key={index}
              width="100%"
              justify="space-between"
            >
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="medium">
                  {getItemDisplayName(item)}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  ${formatCents(item.price_per_unit)} each
                </Text>
              </VStack>
              <HStack gap={2}>
                <Input
                  type="number"
                  min={0}
                  max={
                    item.merchandise_id
                      ? tripMerchandise.find(
                          (m) => m.id === item.merchandise_id,
                        )?.quantity_available ?? 999
                      : (() => {
                          const pricing = tripPricing.find(
                            (p) => p.ticket_type === item.item_type,
                          )
                          if (!pricing) return 999
                          const otherSameType = selectedItems
                            .filter(
                              (x, i) =>
                                i !== index &&
                                !x.merchandise_id &&
                                x.item_type === item.item_type,
                            )
                            .reduce((sum, x) => sum + x.quantity, 0)
                          return Math.max(
                            0,
                            pricing.remaining - otherSameType,
                          )
                        })()
                  }
                  value={item.quantity}
                  onChange={(e) =>
                    updateItemQuantity(
                      index,
                      Number.parseInt(e.target.value) || 0,
                    )
                  }
                  style={{ width: "60px" }}
                />
                <Text fontSize="sm" fontWeight="medium">
                  ${formatCents(item.quantity * item.price_per_unit)}
                </Text>
                <IconButton
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                >
                  <FiTrash2 />
                </IconButton>
              </HStack>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  )
}
