import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Flex,
  Select,
  Text,
  Textarea,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import {
  type TripBulkRefundResult,
  type TripPublic,
  TripsService,
} from "@/client"
import {
  REFUND_REASON_OTHER,
  REFUND_REASONS,
} from "@/components/Bookings/refundReasons"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"

interface RefundTripBookingsProps {
  trip: TripPublic
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function RefundTripBookings({
  trip,
  isOpen,
  onOpenChange,
}: RefundTripBookingsProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")
  const [result, setResult] = useState<TripBulkRefundResult | null>(null)

  const previewQuery = useQuery({
    queryKey: ["trip-refundable-bookings", trip.id],
    queryFn: () =>
      TripsService.readTripRefundableBookings({ tripId: trip.id }),
    enabled: isOpen,
  })

  useEffect(() => {
    if (isOpen) {
      setRefundReason("")
      setRefundNotes("")
      setResult(null)
    }
  }, [isOpen])

  const refundMutation = useMutation({
    mutationFn: () =>
      TripsService.refundTripPaidBookingsEndpoint({
        tripId: trip.id,
        requestBody: {
          refund_reason: refundReason.trim(),
          refund_notes: refundNotes.trim() || undefined,
        },
      }),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
      queryClient.invalidateQueries({
        queryKey: ["trip-refundable-bookings", trip.id],
      })
      if (data.refunded_count > 0 && data.failed_count === 0) {
        showSuccessToast(
          `Refunded ${data.refunded_count} booking(s) ($${formatCents(data.total_refunded_cents)}).`,
        )
      } else if (data.refunded_count > 0) {
        showSuccessToast(
          `Refunded ${data.refunded_count} booking(s) ($${formatCents(data.total_refunded_cents)}). ${data.failed_count} failed.`,
        )
      } else if (data.failed_count > 0) {
        showErrorToast(`No bookings were refunded. ${data.failed_count} failed.`)
      } else {
        showSuccessToast("No eligible bookings to refund.")
      }
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } })?.body?.detail
      showErrorToast(
        typeof detail === "string" ? detail : "Failed to process trip refunds",
      )
    },
  })

  const isOtherReason = refundReason.trim() === REFUND_REASON_OTHER
  const preview = previewQuery.data
  const previewCount = preview?.count ?? 0
  const previewTotalCents = preview?.total_refundable_cents ?? 0
  const showResults = result !== null

  const handleProcessRefund = () => {
    if (!refundReason.trim()) {
      showErrorToast("Please select a refund reason")
      return
    }
    if (isOtherReason && !refundNotes.trim()) {
      showErrorToast("Please provide notes when selecting Other as the reason")
      return
    }
    if (previewCount === 0) {
      showErrorToast("No eligible bookings to refund on this trip.")
      return
    }
    refundMutation.mutate()
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => !open && handleClose()}
      size={{ base: "xs", md: "md" }}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund paid bookings</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack align="stretch" gap={4}>
            <Alert.Root status="error" variant="surface">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Destructive action</Alert.Title>
                <Alert.Description>
                  This will fully refund every confirmed, paid booking on this
                  trip that has a Stripe payment. Checked-in bookings, partially
                  refunded bookings, and bookings without Stripe payments are
                  skipped. Refunds cannot be undone.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>

            {previewQuery.isLoading ? (
              <Text fontSize="sm" color="text.muted">
                Loading eligible bookings…
              </Text>
            ) : previewQuery.isError ? (
              <Text fontSize="sm" color="red.500">
                Could not load eligible bookings for this trip.
              </Text>
            ) : preview ? (
              <VStack align="stretch" gap={3}>
                <Box
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="md"
                  p={3}
                  fontSize="sm"
                >
                  <Text fontWeight="medium" mb={2}>
                    Trip totals (for comparison)
                  </Text>
                  <Text color="text.muted">
                    Trips table: {preview.committed_passengers} committed
                    passenger
                    {preview.committed_passengers === 1 ? "" : "s"},{" "}
                    ${formatCents(preview.trip_sales_cents)} sales (excludes tax,
                    includes checked-in).
                  </Text>
                  <Text color="text.muted" mt={2}>
                    Bulk refund only affects confirmed bookings that are paid via
                    Stripe with no prior refund. Refund amounts use the full
                    booking total (includes tax).
                  </Text>
                </Box>

                <Text fontSize="sm" color="text.muted">
                  {previewCount === 0
                    ? "No eligible bookings on this trip."
                    : `${previewCount} booking${previewCount === 1 ? "" : "s"} will be fully refunded for $${formatCents(previewTotalCents)}.`}
                </Text>

                {preview.bookings.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      To refund
                    </Text>
                    <VStack align="stretch" gap={1}>
                      {preview.bookings.map((booking) => (
                        <Flex
                          key={booking.confirmation_code}
                          justify="space-between"
                          fontSize="sm"
                          gap={2}
                        >
                          <Text fontFamily="mono">
                            {booking.confirmation_code}
                          </Text>
                          <Text color="text.muted">
                            ${formatCents(booking.refund_amount_cents)}
                          </Text>
                        </Flex>
                      ))}
                    </VStack>
                  </Box>
                )}

                {preview.skipped.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Skipped ({preview.skipped_count},{" "}
                      ${formatCents(preview.skipped_total_cents)} not refunded)
                    </Text>
                    <VStack align="stretch" gap={2}>
                      {preview.skipped.map((booking) => (
                        <Box
                          key={booking.confirmation_code}
                          fontSize="sm"
                          p={2}
                          bg="bg.subtle"
                          borderRadius="md"
                        >
                          <Flex justify="space-between" gap={2}>
                            <Text fontFamily="mono" fontWeight="medium">
                              {booking.confirmation_code}
                            </Text>
                            <Text color="text.muted">
                              ${formatCents(booking.refund_amount_cents)}
                            </Text>
                          </Flex>
                          <Text color="text.muted">
                            {booking.skip_reason_label}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            ) : null}

            {showResults ? (
              <Box
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="md"
                p={4}
              >
                <Text fontWeight="medium" mb={2}>
                  Refund report
                </Text>
                <Text fontSize="sm" mb={3}>
                  Refunded {result.refunded_count} booking
                  {result.refunded_count === 1 ? "" : "s"} ($
                  {formatCents(result.total_refunded_cents)}).
                  {result.failed_count > 0
                    ? ` ${result.failed_count} failed.`
                    : ""}
                </Text>
                {result.failures.length > 0 && (
                  <VStack align="stretch" gap={2}>
                    <Text fontSize="sm" fontWeight="medium">
                      Failures
                    </Text>
                    {result.failures.map((failure) => (
                      <Box
                        key={failure.confirmation_code}
                        fontSize="sm"
                        p={2}
                        bg="bg.subtle"
                        borderRadius="md"
                      >
                        <Text fontWeight="medium">
                          {failure.confirmation_code}
                        </Text>
                        <Text color="text.muted">{failure.detail}</Text>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            ) : (
              <>
                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Refund reason *
                  </Text>
                  <Select.Root
                    collection={createListCollection({
                      items: REFUND_REASONS.map((r) => ({
                        label: r,
                        value: r,
                      })),
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
                          <Select.Item key={r} item={{ value: r, label: r }}>
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
                    Notes {isOtherReason ? "*" : "(optional)"}
                  </Text>
                  <Textarea
                    placeholder={
                      isOtherReason
                        ? "Please describe the reason..."
                        : "Additional details..."
                    }
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    rows={2}
                    required={isOtherReason}
                    aria-required={isOtherReason}
                  />
                </Box>
              </>
            )}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <ButtonGroup>
            <DialogActionTrigger asChild>
              <Button variant="outline" onClick={handleClose}>
                {showResults ? "Close" : "Cancel"}
              </Button>
            </DialogActionTrigger>
            {!showResults && (
              <Button
                colorPalette="red"
                onClick={handleProcessRefund}
                loading={refundMutation.isPending}
                disabled={
                  previewQuery.isLoading ||
                  previewQuery.isError ||
                  previewCount === 0 ||
                  !refundReason.trim() ||
                  (isOtherReason && !refundNotes.trim())
                }
              >
                Process refunds
              </Button>
            )}
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
