import {
  Button,
  Card,
  Flex,
  HStack,
  Heading,
  Input,
  NumberInput,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"

import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import { formatCents } from "@/utils"

import type { BookingStepData } from "../bookingTypes"

interface OrderPriceSummaryProps {
  bookingData: BookingStepData
  discountCode: string
  setDiscountCode: (code: string) => void
  discountCodeError: string
  appliedDiscountCode: any
  discountAmount: number
  validateDiscountCode: (code: string) => void
  taxRatePercent: number
  tip: number
  setTip: (tip: number) => void
}

const OrderPriceSummary = ({
  bookingData,
  discountCode,
  setDiscountCode,
  discountCodeError,
  appliedDiscountCode,
  discountAmount,
  validateDiscountCode,
  taxRatePercent,
  tip,
  setTip,
}: OrderPriceSummaryProps) => {
  return (
    <Card.Root bg="bg.panel">
      <Card.Body>
        <Heading size="2xl" mb={4}>
          Pricing Summary
        </Heading>
        <VStack gap={3} align="stretch">
          <HStack justify="space-between">
            <Text fontWeight="medium" fontSize="lg">
              Subtotal:
            </Text>
            <Text fontWeight="semibold" fontSize="lg">
              ${formatCents(bookingData.subtotal)}
            </Text>
          </HStack>
          <Separator />

          {/* Discount Code */}
          <VStack align="stretch" gap={2}>
            <Flex
              direction={{ base: "column", sm: "row" }}
              align={{ base: "stretch", sm: "center" }}
              justify="space-between"
              gap={2}
            >
              <Text>Discount Code:</Text>
              <HStack
                gap={2}
                flex={1}
                maxW={{ base: "100%", sm: "200px" }}
              >
                <Input
                  size={{ base: "md", sm: "sm" }}
                  placeholder="Enter code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  onBlur={() => validateDiscountCode(discountCode)}
                  flex={1}
                  minW={0}
                  borderColor={discountCodeError ? "red.500" : undefined}
                />
                <Button
                  size={{ base: "md", sm: "sm" }}
                  onClick={() => validateDiscountCode(discountCode)}
                  disabled={!discountCode.trim()}
                >
                  Apply
                </Button>
              </HStack>
            </Flex>
            {discountCodeError && (
              <Text fontSize="sm" color="red.500">
                {discountCodeError}
              </Text>
            )}
            {appliedDiscountCode && (
              <HStack justify="space-between">
                <Text fontSize="sm" color="green.500">
                  {appliedDiscountCode.code} applied
                </Text>
                <Text
                  fontSize="sm"
                  color="green.500"
                  fontWeight="semibold"
                >
                  -${formatCents(bookingData.discount_amount)}
                </Text>
              </HStack>
            )}
          </VStack>

          <Separator />

          {/* Tax */}
          <HStack justify="space-between">
            <Text>Tax ({taxRatePercent.toFixed(2)}%):</Text>
            <Text fontSize="sm" fontWeight="semibold">
              ${formatCents(bookingData.tax_amount)}
            </Text>
          </HStack>

          <Separator />

          {/* Tip */}
          <VStack align="stretch" gap={2}>
            <Flex
              direction={{ base: "column", sm: "row" }}
              justify="space-between"
              align={{ base: "stretch", sm: "center" }}
              gap={2}
              flexWrap="wrap"
            >
              <HStack gap={2} flexWrap="wrap">
                <StarFleetTipLabel />
                {[10, 15, 20, 25].map((percentage) => {
                  const effectiveDiscount = Math.min(
                    discountAmount,
                    bookingData.subtotal,
                  )
                  const suggestedAmount = Math.round(
                    Math.max(
                      0,
                      (bookingData.subtotal - effectiveDiscount) *
                        (percentage / 100),
                    ),
                  )
                  return (
                    <Button
                      key={percentage}
                      size="xs"
                      variant="outline"
                      onClick={() => setTip(suggestedAmount)}
                    >
                      {percentage}%
                    </Button>
                  )
                })}
                <Button
                  size={{ base: "sm", sm: "xs" }}
                  variant="outline"
                  onClick={() => setTip(0)}
                >
                  No Star Fleet tip
                </Button>
              </HStack>
              <NumberInput.Root
                size={{ base: "md", sm: "sm" }}
                min={0}
                value={(tip / 100).toFixed(2)}
                onValueChange={(details) => {
                  const dollars =
                    Number.parseFloat(details.value || "0") || 0
                  setTip(Math.round(dollars * 100))
                }}
                w={{ base: "100%", sm: "120px" }}
                minW={{ base: "80px", sm: "120px" }}
              >
                <NumberInput.Input />
              </NumberInput.Root>
            </Flex>
          </VStack>

          <Separator />

          {/* Total */}
          <HStack justify="space-between">
            <Text fontWeight="bold" fontSize="xl">
              Total:
            </Text>
            <Text fontWeight="bold" fontSize="xl">
              ${formatCents(bookingData.total)}
            </Text>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

export default OrderPriceSummary
