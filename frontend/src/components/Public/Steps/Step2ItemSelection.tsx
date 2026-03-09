import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Heading,
  IconButton,
  NumberInput,
  Select,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { FiAlertCircle, FiTrash2 } from "react-icons/fi"

import type { EffectivePricingItem, TripMerchandisePublic } from "@/client"
import { formatCents } from "@/utils"

import type { BookingStepData } from "../bookingTypes"
import OrderPriceSummary from "./OrderPriceSummary"
import { useStep2Logic } from "./useStep2Logic"

interface Step2ItemSelectionProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
  onBack: () => void
  accessCode?: string | null
}

const Step2ItemSelection = ({
  bookingData,
  updateBookingData,
  onNext,
  onBack,
  accessCode,
}: Step2ItemSelectionProps) => {
  const {
    tripPricing,
    tripMerchandise,
    taxRatePercent,
    jurisdictionMissing,
    discountCode,
    setDiscountCode,
    discountCodeError,
    appliedDiscountCode,
    discountAmount,
    validateDiscountCode,
    tip,
    setTip,
    boatRemainingCapacity,
    totalTicketsSelected,
    canAddTicketType,
    merchandiseVariantByKey,
    setMerchandiseVariantByKey,
    variantOptionsList,
    addTicket,
    addMerchandise,
    updateItemQuantity,
    removeItem,
  } = useStep2Logic({ bookingData, updateBookingData, accessCode })

  const canProceed = bookingData.selectedItems.length > 0

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="5xl" mb={2} fontWeight="200">
          Select Tickets & Merchandise
        </Heading>
        <Text color="text.muted" mb={6}>
          Choose your tickets and any merchandise you'd like to purchase.
        </Text>
      </Box>

      {jurisdictionMissing && (
        <Card.Root bg="status.error" borderColor="red.500" borderWidth="1px">
          <Card.Body>
            <HStack gap={3}>
              <FiAlertCircle size={24} />
              <Box>
                <Text fontWeight="semibold" mb={1}>
                  Tax Configuration Error
                </Text>
                <Text fontSize="sm">
                  No tax jurisdiction is configured for this location. Please
                  contact support to complete your booking.
                </Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      <Flex
        direction={{ base: "column", lg: "row" }}
        align="stretch"
        gap={6}
      >
        {/* Left Column - Selection */}
        <VStack gap={4} align="stretch" flex={1}>
          {/* Ticket Selection */}
          {tripPricing && tripPricing.length > 0 && (
            <Card.Root bg="bg.panel">
              <Card.Body>
                <Heading size="2xl" mb={4}>
                  Tickets
                </Heading>
                <Text fontSize="sm" color="text.muted" mb={3}>
                  {boatRemainingCapacity - totalTicketsSelected > 0
                    ? `${boatRemainingCapacity - totalTicketsSelected} seat(s) remaining on boat`
                    : "Boat is at full capacity"}
                </Text>
                <VStack gap={3} align="stretch">
                  {tripPricing.map((pricing: EffectivePricingItem) => (
                    <HStack key={pricing.ticket_type} justify="space-between">
                      <Box>
                        <Text fontWeight="medium" fontSize="lg">
                          {pricing.ticket_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                        <Text fontSize="sm" color="gray.400">
                          ${formatCents(pricing.price)} each
                        </Text>
                        {pricing.remaining >= 0 && (
                          <Text fontSize="xs" color="text.muted" mt={1}>
                            {pricing.remaining} left
                          </Text>
                        )}
                      </Box>
                      <Button
                        size={{ base: "md", sm: "sm" }}
                        disabled={!canAddTicketType(pricing.ticket_type)}
                        onClick={() =>
                          addTicket(pricing.ticket_type, pricing.price)
                        }
                      >
                        Add
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Merchandise Selection */}
          {tripMerchandise && tripMerchandise.length > 0 && (
            <Card.Root bg="bg.panel">
              <Card.Body>
                <Heading size="2xl" mb={4}>
                  Merchandise
                </Heading>
                <VStack gap={3} align="stretch">
                  {tripMerchandise.map(
                    (merchandise: TripMerchandisePublic) => {
                      const options = variantOptionsList(
                        merchandise.variant_options,
                      )
                      const hasVariants = options.length > 0
                      const selectedVariant =
                        merchandiseVariantByKey[merchandise.id] ?? options[0]
                      return (
                        <HStack
                          key={merchandise.id}
                          justify="space-between"
                          align="end"
                          gap={2}
                        >
                          <Box flex={1}>
                            <Text fontWeight="medium" fontSize="lg">
                              {merchandise.name}
                            </Text>
                            {merchandise.description && (
                              <Text
                                fontSize="sm"
                                color="gray.400"
                                lineClamp={2}
                              >
                                {merchandise.description}
                              </Text>
                            )}
                            <HStack gap={2} mt={1}>
                              <Text fontSize="sm" color="gray.400">
                                ${formatCents(merchandise.price)} each
                              </Text>
                              <Badge
                                colorPalette={
                                  merchandise.quantity_available > 0
                                    ? "green"
                                    : "red"
                                }
                              >
                                {merchandise.quantity_available} available
                              </Badge>
                            </HStack>
                          </Box>
                          <HStack gap={2} align="end">
                            {hasVariants && (
                              <Select.Root
                                size="sm"
                                width="min(120px, 25vw)"
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
                              size={{ base: "md", sm: "sm" }}
                              colorPalette="blue"
                              disabled={
                                merchandise.quantity_available === 0 ||
                                (hasVariants && !selectedVariant)
                              }
                              onClick={() =>
                                addMerchandise(
                                  merchandise,
                                  hasVariants ? selectedVariant : undefined,
                                )
                              }
                            >
                              Add
                            </Button>
                          </HStack>
                        </HStack>
                      )
                    },
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}
        </VStack>

        {/* Right Column - Selected Items & Pricing */}
        <VStack gap={4} align="stretch" flex={1}>
          {/* Selected Items */}
          <Card.Root bg="bg.panel">
            <Card.Body>
              <Heading size="2xl" mb={4}>
                Selected Items
              </Heading>
              {bookingData.selectedItems.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={4}>
                  No items selected
                </Text>
              ) : (
                <VStack gap={3} align="stretch">
                  {bookingData.selectedItems.map((item, index) => {
                    const merchandise = tripMerchandise?.find(
                      (m) => m.id === item.trip_merchandise_id,
                    )
                    const pricing = tripPricing?.find(
                      (p: EffectivePricingItem) =>
                        p.ticket_type === item.item_type,
                    )
                    const itemName = merchandise
                      ? item.variant_option
                        ? `${merchandise.name} – ${item.variant_option}`
                        : merchandise.name
                      : pricing
                        ? pricing.ticket_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())
                        : item.item_type

                    const maxQuantity = merchandise
                      ? merchandise.quantity_available
                      : (() => {
                          if (!item.trip_merchandise_id && pricing) {
                            const otherSameType =
                              bookingData.selectedItems
                                .filter(
                                  (x, i) =>
                                    i !== index &&
                                    !x.trip_merchandise_id &&
                                    x.item_type === item.item_type,
                                )
                                .reduce((sum, x) => sum + x.quantity, 0)
                            const maxByType = Math.max(
                              0,
                              pricing.remaining - otherSameType,
                            )
                            const otherTickets =
                              bookingData.selectedItems
                                .filter(
                                  (x, i) =>
                                    i !== index && !x.trip_merchandise_id,
                                )
                                .reduce((sum, x) => sum + x.quantity, 0)
                            const maxByBoat = Math.max(
                              0,
                              boatRemainingCapacity - otherTickets,
                            )
                            return Math.min(maxByType, maxByBoat)
                          }
                          return 999
                        })()

                    return (
                      <HStack
                        key={index}
                        justify="space-between"
                        px={3}
                        py={2}
                        bg="bg.accent"
                        borderRadius="md"
                      >
                        <Box flex={1}>
                          <Text fontWeight="medium">{itemName}</Text>
                          <Text fontSize="sm" color="gray.400">
                            ${formatCents(item.price_per_unit)} ×{" "}
                            {item.quantity}
                          </Text>
                        </Box>
                        <HStack gap={2}>
                          <NumberInput.Root
                            size={{ base: "md", sm: "sm" }}
                            min={0}
                            max={maxQuantity}
                            value={item.quantity.toString()}
                            onValueChange={(details) =>
                              updateItemQuantity(
                                index,
                                Number.parseInt(details.value) || 0,
                              )
                            }
                            w={{ base: "100px", sm: "80px" }}
                            minW={{ base: "80px", sm: "80px" }}
                          >
                            <NumberInput.Input />
                            <NumberInput.Control>
                              <NumberInput.IncrementTrigger />
                              <NumberInput.DecrementTrigger />
                            </NumberInput.Control>
                          </NumberInput.Root>
                          <IconButton
                            size={{ base: "md", sm: "sm" }}
                            aria-label="Remove item"
                            onClick={() => removeItem(index)}
                            variant="ghost"
                          >
                            <FiTrash2 />
                          </IconButton>
                        </HStack>
                      </HStack>
                    )
                  })}
                </VStack>
              )}
            </Card.Body>
          </Card.Root>

          <OrderPriceSummary
            bookingData={bookingData}
            discountCode={discountCode}
            setDiscountCode={setDiscountCode}
            discountCodeError={discountCodeError}
            appliedDiscountCode={appliedDiscountCode}
            discountAmount={discountAmount}
            validateDiscountCode={validateDiscountCode}
            taxRatePercent={taxRatePercent}
            tip={tip}
            setTip={setTip}
          />
        </VStack>
      </Flex>

      {/* Navigation */}
      <Flex
        justify="space-between"
        pt={4}
        gap={4}
        direction={{ base: "column-reverse", sm: "row" }}
      >
        <Button
          variant="outline"
          onClick={onBack}
          size={{ base: "lg", sm: "md" }}
          w={{ base: "100%", sm: "auto" }}
        >
          Back
        </Button>
        <Button
          colorPalette="blue"
          onClick={onNext}
          disabled={!canProceed || jurisdictionMissing}
          size={{ base: "lg", sm: "md" }}
          w={{ base: "100%", sm: "auto" }}
        >
          Continue to Information
        </Button>
      </Flex>
    </VStack>
  )
}

export default Step2ItemSelection
