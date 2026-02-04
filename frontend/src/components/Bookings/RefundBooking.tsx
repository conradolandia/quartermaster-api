import {
  Box,
  Button,
  ButtonGroup,
  NumberInput,
  Select,
  Text,
  Textarea,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { BookingsService, type BookingPublic } from "@/client"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { DialogActionTrigger } from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"
import { getRefundedCents, isPartiallyRefunded } from "./types"

const REFUND_REASONS = [
  "Customer requested cancellation",
  "Change in party size",
  "Could not make date",
  "Weather conditions",
  "Technical issues",
  "Service quality issues",
  "Medical emergency",
  "Other",
]

interface RefundBookingProps {
  booking: BookingPublic
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function RefundBooking({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: RefundBookingProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")
  const [refundAmountCents, setRefundAmountCents] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen && booking) {
      const remaining = booking.total_amount - getRefundedCents(booking)
      setRefundAmountCents(remaining > 0 ? remaining : null)
      setRefundReason("")
      setRefundNotes("")
    }
  }, [isOpen, booking])

  const refundMutation = useMutation({
    mutationFn: (payload: {
      refundReason: string
      refundNotes?: string
      refundAmountCents?: number
    }) =>
      BookingsService.processRefund({
        confirmationCode: booking.confirmation_code,
        requestBody: {
          refund_reason: payload.refundReason,
          refund_notes: payload.refundNotes ?? undefined,
          refund_amount_cents: payload.refundAmountCents,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Refund processed successfully")
      onSuccess?.()
      onClose()
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({
        queryKey: ["booking", booking.confirmation_code],
      })
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } })?.body?.detail
      showErrorToast(
        typeof detail === "string" ? detail : "Failed to process refund",
      )
    },
  })

  const handleProcessRefund = () => {
    if (!refundReason.trim()) {
      showErrorToast("Please select a refund reason")
      return
    }
    const remaining = booking.total_amount - getRefundedCents(booking)
    if (
      refundAmountCents !== null &&
      refundAmountCents > remaining
    ) {
      showErrorToast(
        `Refund amount cannot exceed remaining ($${formatCents(remaining)})`,
      )
      return
    }
    refundMutation.mutate({
      refundReason: refundReason.trim(),
      refundNotes: refundNotes.trim() || undefined,
      refundAmountCents: refundAmountCents ?? undefined,
    })
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
      size={{ base: "xs", md: "sm" }}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund booking</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack align="stretch" gap={4}>
            {isPartiallyRefunded(booking) && (
              <Text fontSize="sm" color="text.muted">
                Already refunded: ${formatCents(getRefundedCents(booking))}.
                Remaining: $
                {formatCents(
                  booking.total_amount - getRefundedCents(booking),
                )}
              </Text>
            )}
            <Box>
              <Text fontWeight="medium" mb={2}>
                Refund reason *
              </Text>
              <Select.Root
                collection={createListCollection({
                  items: REFUND_REASONS.map((r) => ({ label: r, value: r })),
                })}
                value={refundReason ? [refundReason] : []}
                onValueChange={(e) => setRefundReason(e.value[0] ?? "")}
              >
                <Select.Control width="100%">
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select a reason" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Select.Positioner>
                  <Select.Content minWidth="280px">
                    {REFUND_REASONS.map((r) => (
                      <Select.Item
                        key={r}
                        item={{ value: r, label: r }}
                      >
                        {r}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
            </Box>
            <Box>
              <Text fontWeight="medium" mb={2}>
                Refund amount (optional, full if empty)
              </Text>
              <NumberInput.Root
                value={
                  refundAmountCents !== null
                    ? (refundAmountCents / 100).toFixed(2)
                    : ""
                }
                onValueChange={(e) => {
                  const v = e.value
                  if (v === "" || v == null) {
                    const remaining =
                      booking.total_amount - getRefundedCents(booking)
                    setRefundAmountCents(remaining > 0 ? remaining : null)
                    return
                  }
                  setRefundAmountCents(
                    Math.round(Number.parseFloat(String(v)) * 100),
                  )
                }}
                min={0}
                max={
                  (booking.total_amount - getRefundedCents(booking)) / 100
                }
                step={0.01}
              >
                <NumberInput.Input placeholder="0.00" />
              </NumberInput.Root>
              <Text fontSize="sm" color="text.muted" mt={1}>
                Max: $
                {formatCents(
                  booking.total_amount - getRefundedCents(booking),
                )}
              </Text>
            </Box>
            <Box>
              <Text fontWeight="medium" mb={2}>
                Notes (optional)
              </Text>
              <Textarea
                placeholder="Additional details..."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                rows={2}
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <ButtonGroup>
            <DialogActionTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </DialogActionTrigger>
            <Button
              colorPalette="red"
              onClick={handleProcessRefund}
              loading={refundMutation.isPending}
              disabled={!refundReason.trim()}
            >
              Process refund
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
