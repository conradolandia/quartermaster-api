import {
  Badge,
  Separator,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import {
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiCornerUpLeft,
  FiDollarSign,
  FiEdit,
  FiMail,
} from "react-icons/fi"

import { BoatsService, BookingsService, TripsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import RefundBooking from "@/components/Bookings/RefundBooking"
import RescheduleBooking from "@/components/Bookings/RescheduleBooking"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents, formatDateTimeInLocationTz } from "@/utils"
import {
  formatPaymentStatusLabel,
  getBookingStatusColor,
  getPaymentStatusColor,
  getRefundedCents,
} from "./types"

interface BookingDetailsProps {
  confirmationCode: string
}

export default function BookingDetails({
  confirmationCode,
}: BookingDetailsProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  useDateFormatPreference()
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
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

  const userTz =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"

  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 500 }),
    enabled: !!booking?.items?.length,
  })

  const { data: boatsData } = useQuery({
    queryKey: ["boats"],
    queryFn: () => BoatsService.readBoats({ limit: 500 }),
    enabled: !!booking?.items?.length,
  })

  const getTripName = (tripId: string) => {
    const trip = tripsData?.data?.find((t: { id: string }) => t.id === tripId)
    return trip
      ? `${trip.type?.replace(/_/g, " ") ?? ""} – ${formatDateTimeInLocationTz(trip.departure_time, trip.timezone)}`
      : tripId
  }

  const getBoatName = (boatId: string) => {
    const boat = boatsData?.data?.find((b: { id: string }) => b.id === boatId)
    return boat ? boat.name : boatId
  }

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
          {booking.booking_status &&
            ["confirmed", "checked_in", "completed"].includes(
              booking.booking_status,
            ) &&
            booking.payment_status !== "refunded" &&
            getRefundedCents(booking) < booking.total_amount && (
              <Button
                size="sm"
                colorPalette="orange"
                variant="outline"
                onClick={() => setRefundDialogOpen(true)}
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
                booking?.booking_status ?? "",
              )
            }
            title={
              !["confirmed", "checked_in", "completed"].includes(
                booking?.booking_status ?? "",
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
          {booking.booking_status !== "checked_in" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRescheduleDialogOpen(true)}
              >
                <Flex align="center" gap={2}>
                  <FiCalendar />
                  Reschedule
                </Flex>
              </Button>
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
            </>
          )}
          {booking.booking_status === "confirmed" && (
            <Button
              size="sm"
              colorPalette="green"
              onClick={() => checkInMutation.mutate()}
              loading={checkInMutation.isPending}
            >
              <Flex align="center" gap={2}>
                <FiCheck />
                Check In
              </Flex>
            </Button>
          )}
          {booking.booking_status === "checked_in" && (
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
            editDisabled={booking.booking_status === "checked_in"}
            onPermanentDeleteSuccess={() => navigate({ to: "/bookings" })}
            hideInMenu={[
              "refund",
              "reschedule",
              "check-in",
              "revert-check-in",
            ]}
          />
        </Flex>
      </Flex>

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

      <RefundBooking
        booking={booking}
        isOpen={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["booking", confirmationCode],
          })
        }}
      />

      <RescheduleBooking
        booking={booking}
        isOpen={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
        onSuccess={(updated) => {
          queryClient.setQueryData(["booking", confirmationCode], updated)
        }}
      />

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
                    <Text fontWeight="bold">Booking:</Text>
                    <Badge
                      colorPalette={getBookingStatusColor(
                        booking.booking_status || "",
                      )}
                    >
                      {(booking.booking_status || "")
                        .replace("_", " ")
                        .toUpperCase() || "UNKNOWN"}
                    </Badge>
                    {booking.payment_status && (
                      <>
                        <Text fontWeight="bold">Payment:</Text>
                        {booking.payment_status === "refunded" ||
                        ((booking.total_amount ?? 0) > 0 &&
                          getRefundedCents(booking) >= (booking.total_amount ?? 0)) ? (
                          <Badge colorPalette="red" textTransform="uppercase">
                            Fully refunded
                          </Badge>
                        ) : booking.payment_status === "partially_refunded" ||
                          getRefundedCents(booking) > 0 ? (
                          <>
                            <Badge
                              colorPalette={getPaymentStatusColor("paid")}
                              textTransform="uppercase"
                            >
                              Paid
                            </Badge>
                            <Badge
                              colorPalette="red"
                              textTransform="uppercase"
                            >
                              Partially refunded
                            </Badge>
                          </>
                        ) : (
                          <Badge
                            colorPalette={getPaymentStatusColor(
                              booking.payment_status,
                            )}
                          >
                            {formatPaymentStatusLabel(booking.payment_status)}
                          </Badge>
                        )}
                      </>
                    )}
                  </Flex>
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Created:</Text>
                    <Text>{formatDateTimeInLocationTz(booking.created_at, userTz)}</Text>
                  </Flex>
                  {booking.updated_at && (
                    <Flex gap={4} mb={2} alignItems="baseline">
                      <Text fontWeight="bold">Last Updated:</Text>
                      <Text>{formatDateTimeInLocationTz(booking.updated_at, userTz)}</Text>
                    </Flex>
                  )}
                  {(() => {
                    const hasRefund =
                      booking.payment_status === "refunded" ||
                      booking.payment_status === "partially_refunded" ||
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
                  <Text>
                    {[booking.first_name, booking.last_name]
                      .filter(Boolean)
                      .join(" ")}
                  </Text>
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
                    Admin Notes:
                  </Text>
                  <Text color="text.muted" fontStyle={booking.admin_notes ? "normal" : "italic"}>
                    {booking.admin_notes || "(none)"}
                  </Text>
                </Flex>
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
                    <StarFleetTipLabel showColon showTooltip={false} />
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
                      <Table.ColumnHeader>Trip</Table.ColumnHeader>
                      <Table.ColumnHeader>Boat</Table.ColumnHeader>
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
                          {item.trip_id ? (
                            <Text fontSize="sm">{getTripName(item.trip_id)}</Text>
                          ) : (
                            <Text fontSize="sm" color="gray.500">
                              —
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {item.boat_id ? (
                            <Text fontSize="sm">{getBoatName(item.boat_id)}</Text>
                          ) : (
                            <Text fontSize="sm" color="gray.500">
                              —
                            </Text>
                          )}
                        </Table.Cell>
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
