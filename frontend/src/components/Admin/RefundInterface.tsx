import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  HStack,
  Heading,
  Input,
  NumberInput,
  Select,
  Text,
  Textarea,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiChevronDown, FiChevronUp, FiSearch, FiX } from "react-icons/fi"

import { type BookingPublic, BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import {
  getRefundedCents,
  isPartiallyRefunded,
} from "@/components/Bookings/types"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"

interface RefundInterfaceProps {
  onBookingRefunded?: (booking: BookingPublic) => void
}

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

const RefundInterface = ({ onBookingRefunded }: RefundInterfaceProps) => {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")
  const [refundAmount, setRefundAmount] = useState<number | null>(null)
  const [currentBooking, setCurrentBooking] = useState<BookingPublic | null>(
    null,
  )

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Look up booking by confirmation code
  const lookupBookingMutation = useMutation({
    mutationFn: (code: string) =>
      BookingsService.getBookingByConfirmationCode({
        confirmationCode: code,
      }),
    onSuccess: (booking) => {
      setCurrentBooking(booking)
      const refunded = getRefundedCents(booking)
      const remaining = booking.total_amount - refunded
      setRefundAmount(remaining > 0 ? remaining : null)
      showSuccessToast("Booking found successfully")
    },
    onError: (error: any) => {
      showErrorToast(error?.response?.data?.detail || "Failed to find booking")
      setCurrentBooking(null)
    },
  })

  // Process refund
  const refundMutation = useMutation({
    mutationFn: ({
      code,
      reason,
      notes,
      amount,
    }: {
      code: string
      reason: string
      notes?: string
      amount?: number
    }) =>
      BookingsService.processRefund({
        confirmationCode: code,
        requestBody: {
          refund_reason: reason,
          refund_notes: notes || undefined,
          refund_amount_cents: amount ?? undefined,
        },
      }),
    onSuccess: (booking) => {
      showSuccessToast("Refund processed successfully!")
      setCurrentBooking(booking)
      onBookingRefunded?.(booking)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (error: any) => {
      showErrorToast(
        error?.response?.data?.detail || "Failed to process refund",
      )
    },
  })

  const handleLookupBooking = () => {
    if (!confirmationCode.trim()) {
      showErrorToast("Please enter a confirmation code")
      return
    }
    lookupBookingMutation.mutate(confirmationCode.trim())
  }

  const handleProcessRefund = () => {
    if (!currentBooking) {
      showErrorToast("No booking selected")
      return
    }

    if (!refundReason.trim()) {
      showErrorToast("Please select a refund reason")
      return
    }

    const remaining = currentBooking.total_amount - getRefundedCents(currentBooking)
    if (refundAmount !== null && refundAmount > remaining) {
      showErrorToast(
        `Refund amount cannot exceed remaining refundable amount ($${formatCents(remaining)})`,
      )
      return
    }

    refundMutation.mutate({
      code: currentBooking.confirmation_code,
      reason: refundReason,
      notes: refundNotes.trim() || undefined,
      amount: refundAmount ?? undefined,
    })
  }

  const handleReset = () => {
    setConfirmationCode("")
    setRefundReason("")
    setRefundNotes("")
    setRefundAmount(null)
    setCurrentBooking(null)
  }

  const reasonsCollection = createListCollection({
    items: REFUND_REASONS.map((reason) => ({
      label: reason,
      value: reason,
    })),
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "blue"
      case "checked_in":
        return "green"
      case "completed":
        return "purple"
      case "cancelled":
        return "red"
      case "refunded":
        return "orange"
      default:
        return "gray"
    }
  }

  const canRefund =
    currentBooking &&
    ["confirmed", "checked_in", "completed"].includes(
      currentBooking.booking_status || "unknown",
    ) &&
    getRefundedCents(currentBooking) < currentBooking.total_amount
  const isRefunded = currentBooking?.payment_status === "refunded"
  const partiallyRefunded = currentBooking && isPartiallyRefunded(currentBooking)
  const remainingRefundable = currentBooking
    ? currentBooking.total_amount - getRefundedCents(currentBooking)
    : 0

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">Refund Processing</Heading>

      {/* Booking Lookup */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={4} align="stretch">
            <Heading size="md">Lookup Booking</Heading>
            <HStack gap={4}>
              <Input
                placeholder="Enter confirmation code"
                value={confirmationCode}
                onChange={(e) =>
                  setConfirmationCode(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => e.key === "Enter" && handleLookupBooking()}
              />
              <Button
                colorPalette="blue"
                onClick={handleLookupBooking}
                loading={lookupBookingMutation.isPending}
              >
                <FiSearch />
                Lookup
              </Button>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Two-column layout for large screens */}
      {currentBooking && (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={6}>
          {/* Booking Details */}
          <Card.Root bg="bg.panel">
            <Card.Body>
              <VStack gap={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <Heading size="md">Booking Details</Heading>
                  <Badge
                    colorPalette={getStatusColor(
                      currentBooking.booking_status || "unknown",
                    )}
                  >
                    {(currentBooking.booking_status || "unknown")
                      .replace("_", " ")
                      .toUpperCase()}
                  </Badge>
                </HStack>

                <VStack gap={3} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Confirmation Code:</Text>
                    <Text fontFamily="mono">
                      {currentBooking.confirmation_code}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Customer:</Text>
                    <Text>{currentBooking.user_name}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Email:</Text>
                    <Text>{currentBooking.user_email}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Phone:</Text>
                    <Text>{currentBooking.user_phone}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Total Amount:</Text>
                    <Text fontWeight="bold">
                      ${formatCents(currentBooking.total_amount)}
                    </Text>
                  </HStack>
                </VStack>

                {currentBooking.items && currentBooking.items.length > 0 && (
                  <BookingExperienceDetails
                    booking={currentBooking}
                    usePublicApis={false}
                    heading="Mission, launch & trip"
                  />
                )}

                {/* Booking Items */}
                {currentBooking.items && currentBooking.items.length > 0 && (
                  <Box>
                    <Text fontWeight="medium" mb={2}>
                      Items:
                    </Text>
                    <VStack gap={2} align="stretch">
                      {currentBooking.items.map((item, index) => (
                        <HStack
                          key={index}
                          justify="space-between"
                          borderRadius="md"
                        >
                          <Text>
                            {item.quantity}x {item.item_type.replace("_", " ")}
                          </Text>
                          <Badge
                            colorPalette={
                              item.status === "refunded" ? "orange" : "blue"
                            }
                          >
                            {item.status}
                          </Badge>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Refund Form or Cannot Refund Message */}
          {canRefund ? (
            <Card.Root bg="bg.panel">
              <Card.Body>
                <VStack gap={4} align="stretch">
                  <Heading size="md">Process Refund</Heading>

                  <VStack gap={4} align="stretch">
                    {partiallyRefunded && (
                      <HStack gap={4} flexWrap="wrap">
                        <Text fontSize="sm" color="text.muted">
                          Already refunded: $
                          {formatCents(getRefundedCents(currentBooking))}
                        </Text>
                        <Text fontSize="sm" color="text.muted">
                          Remaining refundable: $
                          {formatCents(remainingRefundable)}
                        </Text>
                      </HStack>
                    )}
                    {/* Refund Amount */}
                    <Box>
                      <Text fontWeight="medium" mb={2}>
                        Refund Amount
                      </Text>
                      <NumberInput.Root
                        value={(
                          (refundAmount ?? remainingRefundable) / 100
                        ).toFixed(2)}
                        onValueChange={(details) => {
                          const dollars =
                            Number.parseFloat(details.value || "0") || 0
                          setRefundAmount(Math.round(dollars * 100))
                        }}
                        min={0}
                        max={remainingRefundable / 100}
                        step={0.01}
                      >
                        <NumberInput.Input placeholder="0.00" />
                        <NumberInput.Control>
                          <NumberInput.IncrementTrigger>
                            <FiChevronUp />
                          </NumberInput.IncrementTrigger>
                          <NumberInput.DecrementTrigger>
                            <FiChevronDown />
                          </NumberInput.DecrementTrigger>
                        </NumberInput.Control>
                      </NumberInput.Root>
                      <Text fontSize="sm" color="text.muted" mt={1}>
                        Maximum: ${formatCents(remainingRefundable)}
                      </Text>
                    </Box>

                    {/* Refund Reason */}
                    <Box>
                      <Text fontWeight="medium" mb={2}>
                        Refund Reason *
                      </Text>
                      <Select.Root
                        collection={reasonsCollection}
                        value={refundReason ? [refundReason] : []}
                        onValueChange={(details) =>
                          setRefundReason(details.value[0] || "")
                        }
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
                          <Select.Content minWidth="300px">
                            {reasonsCollection.items.map((item) => (
                              <Select.Item key={item.value} item={item}>
                                {item.label}
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Select.Root>
                    </Box>

                    {/* Refund Notes */}
                    <Box>
                      <Text fontWeight="medium" mb={2}>
                        Additional Notes (Optional)
                      </Text>
                      <Textarea
                        placeholder="Add any additional details about the refund..."
                        value={refundNotes}
                        onChange={(e) => setRefundNotes(e.target.value)}
                        rows={3}
                      />
                    </Box>

                    {/* Actions */}
                    <HStack gap={4} justify="flex-end">
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={refundMutation.isPending}
                      >
                        <FiX />
                        Reset
                      </Button>
                      <Button
                        colorPalette="red"
                        onClick={handleProcessRefund}
                        loading={refundMutation.isPending}
                        disabled={!refundReason.trim()}
                      >
                        Process Refund
                      </Button>
                    </HStack>
                  </VStack>
                </VStack>
              </Card.Body>
            </Card.Root>
          ) : isRefunded ? (
            <Card.Root bg="bg.panel" borderColor="green.200">
              <Card.Body>
                <VStack gap={4} align="stretch">
                  <Text color="green.600" fontWeight="medium">
                    Refund completed
                  </Text>
                  <Text color="text.muted">
                    This booking has been refunded. Items above show refunded
                    status.
                  </Text>
                  {(() => {
                    const itemWithDetails = currentBooking.items?.find(
                      (i) => i.refund_reason || i.refund_notes,
                    )
                    if (!itemWithDetails) return null
                    return (
                      <VStack gap={2} align="stretch">
                        <Text fontWeight="medium" fontSize="sm">
                          Refund details
                        </Text>
                        <Box fontSize="sm" color="text.muted">
                          {itemWithDetails.refund_reason && (
                            <Text>Reason: {itemWithDetails.refund_reason}</Text>
                          )}
                          {itemWithDetails.refund_notes && (
                            <Text>Notes: {itemWithDetails.refund_notes}</Text>
                          )}
                        </Box>
                      </VStack>
                    )
                  })()}
                </VStack>
              </Card.Body>
            </Card.Root>
          ) : (
            <Card.Root bg="bg.panel" borderColor="red.200">
              <Card.Body>
                <VStack gap={4} align="center">
                  <Text color="red.600" fontWeight="medium">
                    This booking cannot be refunded
                  </Text>
                  <Text color="text.muted" textAlign="center">
                    Only bookings with status "confirmed", "checked_in", or
                    "completed" can be refunded. Current status:{" "}
                    {(currentBooking.booking_status || "unknown")
                      .replace("_", " ")
                      .toUpperCase()}
                  </Text>
                  <Button variant="outline" onClick={handleReset}>
                    <FiX />
                    Reset
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          )}
        </Grid>
      )}
    </VStack>
  )
}

export default RefundInterface
