import {
  Badge,
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
import { useState } from "react"
import { FiArrowLeft, FiCheck, FiCode, FiMail, FiPrinter } from "react-icons/fi"

import { BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"
import { formatDate, getStatusColor } from "./types"

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
          <Button size="sm" variant="ghost" onClick={handlePrint}>
            <Flex align="center" gap={2}>
              <FiPrinter />
              Print
            </Flex>
          </Button>
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setJsonDialogOpen(true)}
          >
            <Flex align="center" gap={2}>
              <FiCode />
              Raw data
            </Flex>
          </Button>
          <Button
            size="sm"
            colorPalette="green"
            onClick={() => checkInMutation.mutate()}
            loading={checkInMutation.isPending}
            disabled={booking.status === "checked_in"}
          >
            <Flex align="center" gap={2}>
              <FiCheck />
              {booking.status === "checked_in"
                ? "Already Checked In"
                : "Check In"}
            </Flex>
          </Button>
          <BookingActionsMenu booking={booking} />
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
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Status:</Text>
                    <Badge colorPalette={getStatusColor(booking.status || "")}>
                      {booking.status?.replace("_", " ").toUpperCase() ||
                        "UNKNOWN"}
                    </Badge>
                  </Flex>
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Created:</Text>
                    <Text>{formatDate(booking.created_at)}</Text>
                  </Flex>
                  {booking.updated_at && (
                    <Flex gap={4} alignItems="baseline">
                      <Text fontWeight="bold">Last Updated:</Text>
                      <Text>{formatDate(booking.updated_at)}</Text>
                    </Flex>
                  )}
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
                  {booking.tax_amount > 0 && (
                    <Flex justify="space-between">
                      <Text>Tax:</Text>
                      <Text>${formatCents(booking.tax_amount)}</Text>
                    </Flex>
                  )}
                  {booking.tip_amount > 0 && (
                    <Flex justify="space-between">
                      <Text>Tip:</Text>
                      <Text>${formatCents(booking.tip_amount)}</Text>
                    </Flex>
                  )}
                  <Flex
                    justify="space-between"
                    fontWeight="bold"
                    fontSize="lg"
                    pt={2}
                    borderTop="1px"
                    borderColor="dark.border.secondary"
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
                    {booking.items.map((item, index) => (
                      <Table.Row key={index}>
                        <Table.Cell>
                          <Text fontWeight="medium">
                            {item.item_type
                              .replace("_", " ")
                              .replace(/\b\w/g, (l: string) => l.toUpperCase())}
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
          <Box>
            <Heading size="md" mb={4}>
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
