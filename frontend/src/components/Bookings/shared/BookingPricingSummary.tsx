import type { BookingUpdate } from "@/client"
import {
  Button,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Controller, type Control, type FieldErrors } from "react-hook-form"

import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import { Field } from "@/components/ui/field"
import { formatCents } from "@/utils"

interface BookingPricingSummaryCreateProps {
  mode: "create"
  subtotalCents: number
  discountAmountCents: number
  taxAmountCents: number
  tipAmountCents: number
  totalAmountCents: number
  discountCode: string
  discountCodeError: string
  appliedDiscountCode: { code: string } | null
  discountInputCents: number
  taxRatePercent: number
  onDiscountCodeChange: (value: string) => void
  onDiscountCodeBlur: () => void
  onDiscountCodeApply: () => void
  onDiscountOverrideChange: (cents: number) => void
  onTipChange: (cents: number) => void
}

interface BookingPricingSummaryEditProps {
  mode: "edit"
  effectiveSubtotalCents: number
  control: Control<BookingUpdate>
  errors: FieldErrors<BookingUpdate>
}

export type BookingPricingSummaryProps =
  | BookingPricingSummaryCreateProps
  | BookingPricingSummaryEditProps

export function BookingPricingSummary(props: BookingPricingSummaryProps) {
  if (props.mode === "create") {
    const p = props
    return (
      <VStack
        gap={3}
        width="100%"
        p={4}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
      >
        <Text fontWeight="bold">Pricing Summary</Text>
        <HStack justify="space-between" width="100%">
          <Text>Subtotal:</Text>
          <Text>${formatCents(p.subtotalCents)}</Text>
        </HStack>
        <VStack align="stretch" gap={2} width="100%">
          <HStack justify="space-between">
            <Text>Discount Code:</Text>
            <HStack gap={2}>
              <Input
                placeholder="Enter code"
                value={p.discountCode}
                onChange={(e) => p.onDiscountCodeChange(e.target.value)}
                onBlur={p.onDiscountCodeBlur}
                style={{ width: "120px" }}
                borderColor={p.discountCodeError ? "red.500" : undefined}
              />
              <Button
                size="sm"
                onClick={p.onDiscountCodeApply}
                disabled={!p.discountCode.trim()}
              >
                Apply
              </Button>
            </HStack>
          </HStack>
          {p.discountCodeError && (
            <Text fontSize="sm" color="red.500">
              {p.discountCodeError}
            </Text>
          )}
          {p.appliedDiscountCode && (
            <HStack justify="space-between">
              <Text fontSize="sm" color="green.500">
                {p.appliedDiscountCode.code} applied
              </Text>
              <Text fontSize="sm" color="green.500">
                -${formatCents(p.discountInputCents)}
              </Text>
            </HStack>
          )}
        </VStack>
        <HStack justify="space-between" width="100%">
          <Text>Discount override (optional, $):</Text>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={p.discountAmountCents / 100}
            onChange={(e) => {
              const dollars = Number.parseFloat(e.target.value) || 0
              p.onDiscountOverrideChange(Math.round(dollars * 100))
            }}
            style={{ width: "100px" }}
          />
        </HStack>
        <HStack justify="space-between" width="100%">
          <Text>Tax Rate:</Text>
          <Text>
            {p.taxRatePercent > 0
              ? `${p.taxRatePercent.toFixed(2)}%`
              : "N/A - No jurisdiction set"}
          </Text>
        </HStack>
        <HStack justify="space-between" width="100%">
          <Text>Tax Amount:</Text>
          <Text>${formatCents(p.taxAmountCents)}</Text>
        </HStack>
        <HStack justify="space-between" width="100%">
          <HStack gap={1}>
            <StarFleetTipLabel showColon showTooltip={false} />
            <Text as="span">($)</Text>
          </HStack>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={p.tipAmountCents / 100}
            onChange={(e) =>
              p.onTipChange(
                Math.round((Number.parseFloat(e.target.value) || 0) * 100),
              )
            }
            style={{ width: "100px" }}
          />
        </HStack>
        <HStack justify="space-between" width="100%" fontWeight="bold">
          <Text>Total:</Text>
          <Text>${formatCents(p.totalAmountCents)}</Text>
        </HStack>
      </VStack>
    )
  }

  const p = props
  return (
    <>
      <Field
        label="Subtotal"
        helperText="Recalculated from item quantities and prices"
      >
        <Input
          value={`$${formatCents(p.effectiveSubtotalCents)}`}
          readOnly
          bg="dark.bg.accent"
          color="text.muted"
          _focus={{ boxShadow: "none" }}
          cursor="default"
        />
      </Field>
      <HStack w="full" gap={3}>
        <Field
          invalid={!!p.errors.discount_amount}
          errorText={p.errors.discount_amount?.message}
          label="Discount Amount"
        >
          <Controller
            name="discount_amount"
            control={p.control}
            rules={{
              min: { value: 0, message: "Discount amount must be at least 0" },
            }}
            render={({ field }) => (
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                min="0"
                value={field.value != null ? field.value / 100 : ""}
                onChange={(e) =>
                  field.onChange(
                    Math.round(
                      (Number.parseFloat(e.target.value) || 0) * 100,
                    ),
                  )
                }
                placeholder="0.00"
              />
            )}
          />
        </Field>
        <Field
          invalid={!!p.errors.tax_amount}
          errorText={p.errors.tax_amount?.message}
          label="Tax Amount"
        >
          <Controller
            name="tax_amount"
            control={p.control}
            rules={{
              min: { value: 0, message: "Tax amount must be at least 0" },
            }}
            render={({ field }) => (
              <Input
                id="tax_amount"
                type="number"
                step="0.01"
                min="0"
                value={field.value != null ? field.value / 100 : ""}
                onChange={(e) =>
                  field.onChange(
                    Math.round(
                      (Number.parseFloat(e.target.value) || 0) * 100,
                    ),
                  )
                }
                placeholder="0.00"
              />
            )}
          />
        </Field>
      </HStack>
      <HStack w="full" gap={3}>
        <Field
          invalid={!!p.errors.tip_amount}
          errorText={p.errors.tip_amount?.message}
          label={<StarFleetTipLabel showTooltip={false} />}
        >
          <Controller
            name="tip_amount"
            control={p.control}
            rules={{
              min: { value: 0, message: "Tip amount must be at least 0" },
            }}
            render={({ field }) => (
              <Input
                id="tip_amount"
                type="number"
                step="0.01"
                min="0"
                value={field.value != null ? field.value / 100 : ""}
                onChange={(e) =>
                  field.onChange(
                    Math.round(
                      (Number.parseFloat(e.target.value) || 0) * 100,
                    ),
                  )
                }
                placeholder="0.00"
              />
            )}
          />
        </Field>
        <Field label="Total Amount">
          <Controller
            name="total_amount"
            control={p.control}
            render={({ field }) => (
              <Input
                value={`$${formatCents(field.value ?? 0)}`}
                readOnly
                bg="dark.bg.accent"
                color="text.muted"
                _focus={{ boxShadow: "none" }}
                cursor="default"
              />
            )}
          />
        </Field>
      </HStack>
      <Text fontSize="xs" color="text.muted">
        Total amount is auto-calculated: (subtotal - discount) + tax + tip
      </Text>
    </>
  )
}
