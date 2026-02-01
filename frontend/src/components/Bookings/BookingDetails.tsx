import {
  Badge,
  Separator,
  Box,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  NumberInput,
  Select,
  Table,
  Text,
  Textarea,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import {
  FiArrowLeft,
  FiCheck,
  FiCornerUpLeft,
  FiDollarSign,
  FiEdit,
  FiMail,
} from "react-icons/fi"

import { BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
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
import {
  formatDate,
  getRefundedCents,
  getStatusColor,
  isPartiallyRefunded,
} from "./types"

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

interface BookingDetailsProps {
  confirmationCode: string
}

export default function BookingDetails({
  confirmationCode,
}: BookingDetailsProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [checkInConfirmOpen, setCheckInConfirmOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")
  const [refundAmountCents, setRefundAmountCents] = useState<number | null>(
    null,
  )
  const [emailSending, setEmailSending] = useState(false)

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["booking", confirmationCode],
    queryFn: () =>
      BookingsService.getBookingByConfirmationCode({
        confirmationCode,
      }),
  })

  const displayItems = useMemo(() => {
    if (!booking?.items?.length) return []
    return [...booking.items].sort((a, b) => {
      const aTicket = !a.trip_merchandise_id ? 0 : 1
      const bTicket = !b.trip_merchandise_id ? 0 : 1
      if (aTicket !== bTicket) return aTicket - bTicket
      const typeCmp = (a.item_type ?? "").localeCompare(b.item_type ?? "")
      if (typeCmp !== 0) return typeCmp
      return (a.id ?? "").localeCompare(b.id ?? "")
    })
  }, [booking?.items])

  const checkInMutation = useMutation({
    mutationFn: () => BookingsService.checkInBooking({ confirmationCode }),
    onSuccess: (updated) => {
      showSuccessToast("Booking checked in successfully")
      queryClient.setQueryData(["booking", confirmationCode], updated)
      setCheckInConfirmOpen(false)
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } })?.body?.detail
      showErrorToast(typeof detail === "string" ? detail : "Failed to check in")
    },
  })

  const revertCheckInMutation = useMutation({
    mutationFn: () =>
      BookingsService.revertCheckIn({ confirmationCode }),
    onSuccess: (updated) => {
      showSuccessToast("Check-in reverted; booking is confirmed again")
      queryClient.setQueryData(["booking", confirmationCode], updated)
    },
    onError: (err: unknown) => {
      const detail = (err as { body?: { detail?: string } })?.body?.detail
      showErrorToast(
        typeof detail === "string" ? detail : "Failed to revert check-in",
      )
    },
  })

  const handleBack = () => {
    navigate({ search: {} })
  }

  const handlePrint = () => {
    window.print()
  }

  const openRefundDialog = () => {
    if (booking) {
      const remaining =
        booking.total_amount - getRefundedCents(booking)
      setRefundAmountCents(remaining > 0 ? remaining : null)
      setRefundReason("")
      setRefundNotes("")
      setRefundDialogOpen(true)
    }
  }

  const refundMutation = useMutation({
    mutationFn: (payload: {
      confirmationCode: string
      refundReason: string
      refundNotes?: string
      refundAmountCents?: number
    }) =>
      BookingsService.processRefund({
        confirmationCode: payload.confirmationCode,
        requestBody: {
          refund_reason: payload.refundReason,
          refund_notes: payload.refundNotes ?? undefined,
          refund_amount_cents: payload.refundAmountCents,
        },
      }),
    onSuccess: (updated) => {
      showSuccessToast("Refund processed successfully")
      queryClient.setQueryData(["booking", confirmationCode], updated)
      setRefundDialogOpen(false)
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
    if (!booking) return
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
      confirmationCode: booking.confirmation_code,
      refundReason: refundReason.trim(),
      refundNotes: refundNotes.trim() || undefined,
      refundAmountCents: refundAmountCents ?? undefined,
    })
  }

  const handleEmail = async () => {
    setEmailSending(true)
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || ""
      const response = await fetch(
        `${apiUrl}/api/v1/bookings/${confirmationCode}/resend-email`,
        {
          method: "POST",
        },
      )
      if (response.ok) {
        showSuccessToast("Confirmation email sent successfully")
      } else {
        const data = await response.json().catch(() => ({}))
        const detail = data?.detail
        showErrorToast(
          typeof detail === "string" ? detail : "Failed to send confirmation email",
        )
      }
    } catch {
      showErrorToast("Failed to send confirmation email")
    } finally {
      setEmailSending(false)
    }
  }

  if (isLoading) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Text>Loading booking details...</Text>
        </VStack>
      </Container>
    )
  }

  if (error || !booking) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Box as={FiArrowLeft} boxSize={8} color="red.500" />
          <Text fontSize="lg" fontWeight="bold">
            Booking Not Found
          </Text>
          <Text color="gray.600">
            No booking found with confirmation code: {confirmationCode}
          </Text>
          <Button onClick={handleBack}>Back to Bookings</Button>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <Flex align="center" justify="space-between" gap={4} pt={12} mb={12}>
        <Heading size="4xl">
          Booking Details for:{" "}
          <Text
            as="span"
            fontFamily="mono"
            fontWeight="bold"
            color="dark.accent.primary"
          >
            {booking.confirmation_code}
          </Text>
        </Heading>
        <Flex align="center" gap={4}>
          <Button size="sm" variant="ghost" onClick={handleBack}>
            <Flex align="center" gap={2}>
              <FiArrowLeft />
              Back to Bookings
            </Flex>
          </Button>
          {booking.status !== "refunded" &&
            getRefundedCents(booking) < booking.total_amount && (
              <Button
                size="sm"
                colorPalette="orange"
                variant="outline"
                onClick={openRefundDialog}
              >
                <Flex align="center" gap={2}>
                  <FiDollarSign />
                  Refund
                </Flex>
              </Button>
            )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEmail}
            loading={emailSending}
            disabled={
              emailSending ||
              !["confirmed", "checked_in", "completed"].includes(
                booking?.status ?? "",
              )
            }
            title={
              !["confirmed", "checked_in", "completed"].includes(
                booking?.status ?? "",
              )
                ? "Resend email is only available for confirmed, checked-in, or completed bookings"
                : undefined
            }
          >
            <Flex align="center" gap={2}>
              <FiMail />
              Resend Email
            </Flex>
          </Button>
          {booking.status !== "checked_in" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditModalOpen(true)}
            >
              <Flex align="center" gap={2}>
                <FiEdit />
                Edit Booking
              </Flex>
            </Button>
          )}
          {booking.status === "confirmed" && (
            <Button
              size="sm"
              colorPalette="green"
              onClick={() => setCheckInConfirmOpen(true)}
              loading={checkInMutation.isPending}
            >
              <Flex align="center" gap={2}>
                <FiCheck />
                Check In
              </Flex>
            </Button>
          )}
          {booking.status === "checked_in" && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="orange"
              onClick={() => revertCheckInMutation.mutate()}
              loading={revertCheckInMutation.isPending}
              title="Revert check-in so the booking is confirmed again"
            >
              <Flex align="center" gap={2}>
                <FiCornerUpLeft />
                Revert Check-in
              </Flex>
            </Button>
          )}
          <BookingActionsMenu
            booking={booking}
            onPrint={handlePrint}
            editModalOpen={editModalOpen}
            onEditModalOpenChange={setEditModalOpen}
            onOpenRawData={() => setJsonDialogOpen(true)}
            editDisabled={booking.status === "checked_in"}
          />
        </Flex>
      </Flex>

      <DialogRoot
        open={checkInConfirmOpen}
        onOpenChange={({ open }) => setCheckInConfirmOpen(open)}
        size={{ base: "xs", md: "sm" }}
        placement="center"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm check-in</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Text>
              Check in booking{" "}
              <Text as="span" fontFamily="mono" fontWeight="bold">
                {booking.confirmation_code}
              </Text>{" "}
              for <Text as="span" fontWeight="bold">{booking.user_name}</Text>?
            </Text>
          </DialogBody>
          <DialogFooter>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </DialogActionTrigger>
              <Button
                colorPalette="green"
                onClick={() => checkInMutation.mutate()}
                loading={checkInMutation.isPending}
                disabled={checkInMutation.isPending}
              >
                {checkInMutation.isPending ? "Checking in..." : "Check In"}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={jsonDialogOpen}
        onOpenChange={({ open }) => setJsonDialogOpen(open)}
        size={{ base: "lg", md: "xl" }}
        placement="center"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking (raw JSON)</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Box
              as="pre"
              p={4}
              borderRadius="md"
              bg="dark.bg.secondary"
              border="1px"
              borderColor="dark.border.secondary"
              overflow="auto"
              maxH="70vh"
              fontSize="xs"
              fontFamily="mono"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
            >
              {JSON.stringify(booking, null, 2)}
            </Box>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJsonDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={refundDialogOpen}
        onOpenChange={({ open }) => setRefundDialogOpen(open)}
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

      <VStack align="stretch" gap={6}>
        <Flex gap={6} direction={{ base: "column", lg: "row" }}>
          <Box flex="2">
            <Heading size="md" mb={4}>
              Booking Information
            </Heading>
            <Box
              p={4}
              borderRadius="md"
              border="1px"
              borderColor="dark.border.secondary"
              color="dark.text.primary"
              bg="dark.bg.secondary"
            >
              <Flex direction="row" gap={4} justify="space-between">
                {booking.qr_code_base64 && (
                  <Box>
                    <img
                      src={`data:image/png;base64,${booking.qr_code_base64}`}
                      alt="Booking QR Code"
                      style={{ maxWidth: "150px", height: "auto" }}
                    />
                  </Box>
                )}
                <Box flex="1">
                  <Flex gap={4} mb={2} alignItems="baseline" flexWrap="wrap">
                    <Text fontWeight="bold">Status:</Text>
                    <Badge colorPalette={getStatusColor(booking.status || "")}>
                      {booking.status?.replace("_", " ").toUpperCase() ||
                        "UNKNOWN"}
                    </Badge>
                    {(booking.status === "refunded" ||
                      getRefundedCents(booking) > 0) && (
                      <Badge colorPalette="red" textTransform="uppercase">
                        {booking.status === "refunded" ||
                        getRefundedCents(booking) >= (booking.total_amount ?? 0)
                          ? "Fully refunded"
                          : "Partially refunded"}
                      </Badge>
                    )}
                  </Flex>
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Created:</Text>
                    <Text>{formatDate(booking.created_at)}</Text>
                  </Flex>
                  {booking.updated_at && (
                    <Flex gap={4} mb={2} alignItems="baseline">
                      <Text fontWeight="bold">Last Updated:</Text>
                      <Text>{formatDate(booking.updated_at)}</Text>
                    </Flex>
                  )}
                  {(() => {
                    const hasRefund =
                      booking.status === "refunded" ||
                      getRefundedCents(booking) > 0
                    if (!hasRefund) return null
                    // Prefer booking-level reason/notes (set on every refund); fall back to first item
                    const itemWithRefund = booking.items?.find(
                      (item) =>
                        (item.refund_reason?.trim() ?? "") !== "" ||
                        (item.refund_notes?.trim() ?? "") !== "",
                    )
                    const reason =
                      booking.refund_reason?.trim() ??
                      itemWithRefund?.refund_reason?.trim() ??
                      "No reason recorded"
                    const notes =
                      booking.refund_notes?.trim() ??
                      itemWithRefund?.refund_notes?.trim() ??
                      ""
                    return (
                      <>
                        <Flex gap={4} mb={2} alignItems="baseline">
                          <Text fontWeight="bold">Refunded amount:</Text>
                          <Text>${formatCents(getRefundedCents(booking))}</Text>
                        </Flex>
                        <Flex gap={4} mb={2} alignItems="baseline">
                          <Text fontWeight="bold">Refund reason:</Text>
                          <Text>{reason}</Text>
                        </Flex>
                        {notes !== "" && (
                          <Flex gap={4} alignItems="baseline">
                            <Text fontWeight="bold">Refund notes:</Text>
                            <Text>{notes}</Text>
                          </Flex>
                        )}
                      </>
                    )
                  })()}
                </Box>
              </Flex>
            </Box>
          </Box>

          <Box flex="2">
            <Heading size="md" mb={4}>
              Customer Information
            </Heading>
            <Box
              bg="dark.bg.secondary"
              p={4}
              borderRadius="md"
              border="1px"
              borderColor="dark.border.secondary"
              color="dark.text.primary"
            >
              <VStack align="stretch" gap={3}>
                <Flex gap={4} alignItems="baseline">
                  <Text fontWeight="bold" minW="120px">
                    Name:
                  </Text>
                  <Text>{booking.user_name}</Text>
                </Flex>
                <Flex gap={4} alignItems="baseline">
                  <Text fontWeight="bold" minW="120px">
                    Email:
                  </Text>
                  <Text>{booking.user_email}</Text>
                </Flex>
                <Flex gap={4} alignItems="baseline">
                  <Text fontWeight="bold" minW="120px">
                    Phone:
                  </Text>
                  <Text>{booking.user_phone}</Text>
                </Flex>
                <Flex gap={4} alignItems="baseline">
                  <Text fontWeight="bold" minW="120px">
                    Billing Address:
                  </Text>
                  <Text>{booking.billing_address}</Text>
                </Flex>
                {booking.special_requests && (
                  <Flex gap={4} alignItems="baseline">
                    <Text fontWeight="bold" minW="120px">
                      Special Requests:
                    </Text>
                    <Text>{booking.special_requests}</Text>
                  </Flex>
                )}
                <Flex gap={4} alignItems="baseline">
                  <Text fontWeight="bold" minW="120px">
                    Launch Updates:
                  </Text>
                  <Text>{booking.launch_updates_pref ? "Yes" : "No"}</Text>
                </Flex>
              </VStack>
            </Box>
          </Box>
        </Flex>

        <Box>
          <Heading size="md" mb={4}>
            Booking Items & Pricing
          </Heading>
          {booking.items && booking.items.length > 0 ? (
            <Flex gap={6} direction={{ base: "column", lg: "row" }}>
              <Box
                flex="1"
                p={4}
                borderRadius="md"
                border="1px"
                borderColor="dark.border.secondary"
                bg="dark.bg.secondary"
              >
                <Heading size="sm" mb={3}>
                  Pricing Breakdown
                </Heading>
                <Separator mb={3} />
                <VStack align="stretch" gap={2}>
                  <Flex justify="space-between">
                    <Text>Subtotal:</Text>
                    <Text>${formatCents(booking.subtotal)}</Text>
                  </Flex>
                  {booking.discount_amount > 0 && (
                    <Flex justify="space-between" color="green.400">
                      <Text>Discount:</Text>
                      <Text>-${formatCents(booking.discount_amount)}</Text>
                    </Flex>
                  )}
                  <Flex justify="space-between">
                    <Text>Tax:</Text>
                    <Text>${formatCents(booking.tax_amount)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text>Tip:</Text>
                    <Text>${formatCents(booking.tip_amount)}</Text>
                  </Flex>
                  <Separator />
                  <Flex
                    justify="space-between"
                    fontWeight="bold"
                    fontSize="lg"
                  >
                    <Text>Total:</Text>
                    <Text>${formatCents(booking.total_amount)}</Text>
                  </Flex>
                </VStack>
              </Box>
              <Box overflowX="auto" flex="2">
                <Table.Root size={{ base: "sm", md: "md" }}>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Item Type</Table.ColumnHeader>
                      <Table.ColumnHeader>Status</Table.ColumnHeader>
                      <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                      <Table.ColumnHeader>Price per Unit</Table.ColumnHeader>
                      <Table.ColumnHeader>Total</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {displayItems.map((item, index) => (
                      <Table.Row key={index}>
                        <Table.Cell>
                          <Text fontWeight="medium">
                            {item.item_type
                              .replace("_", " ")
                              .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            {item.variant_option
                              ? ` – ${item.variant_option}`
                              : ""}
                          </Text>
                          {item.trip_merchandise_id && (
                            <Text fontSize="sm" color="gray.400">
                              (Merchandise Item)
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            colorPalette={
                              item.status === "active"
                                ? "green"
                                : item.status === "refunded"
                                  ? "red"
                                  : item.status === "fulfilled"
                                    ? "blue"
                                    : "gray"
                            }
                          >
                            {item.status?.replace("_", " ").toUpperCase()}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>{item.quantity}</Table.Cell>
                        <Table.Cell>
                          ${formatCents(item.price_per_unit)}
                        </Table.Cell>
                        <Table.Cell>
                          $
                          {formatCents(
                            (item.price_per_unit || 0) * item.quantity,
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Flex>
          ) : (
            <Text color="gray.500">No items found for this booking.</Text>
          )}
        </Box>

        {booking.items && booking.items.length > 0 && (
          <Box my={5}>
            <Heading size="md" mb={3}>
              Mission, launch & trip
            </Heading>
            <Separator mb={3} />
            <BookingExperienceDetails
              booking={booking}
              usePublicApis={false}
              showHeading={false}
            />
          </Box>
        )}
      </VStack>
    </Container>
  )
}
