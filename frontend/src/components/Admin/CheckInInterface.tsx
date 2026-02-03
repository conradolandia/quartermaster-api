import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  HStack,
  Heading,
  Input,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCheck, FiCornerUpLeft, FiEdit, FiSearch, FiX } from "react-icons/fi"

import { type BookingPublic, BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import EditBooking from "@/components/Bookings/EditBooking"
import {
  getRefundedCents,
  isPartiallyRefunded,
} from "@/components/Bookings/types"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"
import { useEffect } from "react"

interface CheckInInterfaceProps {
  /** When set (e.g. from URL ?code=), load this booking on mount. Used by QR scan flow. */
  initialCode?: string
  onBookingCheckedIn?: (booking: BookingPublic) => void
}

const CheckInInterface = ({
  initialCode,
  onBookingCheckedIn,
}: CheckInInterfaceProps) => {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [currentBooking, setCurrentBooking] = useState<BookingPublic | null>(
    null,
  )
  const [isEditOpen, setIsEditOpen] = useState(false)

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
      showSuccessToast("Booking found successfully")
    },
    onError: (error: any) => {
      showErrorToast(error?.response?.data?.detail || "Failed to find booking")
      setCurrentBooking(null)
    },
  })

  // Check in booking
  const checkInMutation = useMutation({
    mutationFn: ({ code }: { code: string }) =>
      BookingsService.checkInBooking({
        confirmationCode: code,
      }),
    onSuccess: (booking) => {
      showSuccessToast("Booking checked in successfully!")
      setCurrentBooking(booking)
      onBookingCheckedIn?.(booking)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (error: any) => {
      showErrorToast(
        error?.response?.data?.detail || "Failed to check in booking",
      )
    },
  })

  const revertCheckInMutation = useMutation({
    mutationFn: ({ code }: { code: string }) =>
      BookingsService.revertCheckIn({ confirmationCode: code }),
    onSuccess: (booking) => {
      showSuccessToast("Check-in reverted; booking is confirmed again")
      setCurrentBooking(booking)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (error: any) => {
      showErrorToast(
        error?.response?.data?.detail || "Failed to revert check-in",
      )
    },
  })

  // Load booking when opened with ?code= (e.g. from QR scan)
  useEffect(() => {
    if (!initialCode?.trim()) return
    setConfirmationCode(initialCode.trim())
    lookupBookingMutation.mutate(initialCode.trim())
  }, [initialCode])

  const handleLookupBooking = () => {
    if (!confirmationCode.trim()) {
      showErrorToast("Please enter a confirmation code")
      return
    }
    lookupBookingMutation.mutate(confirmationCode.trim())
  }

  const handleCheckIn = () => {
    if (!currentBooking?.confirmation_code) return
    checkInMutation.mutate({ code: confirmationCode })
  }

  const handleReset = () => {
    setConfirmationCode("")
    setCurrentBooking(null)
    setIsEditOpen(false)
  }

  const refetchCurrentBooking = async () => {
    if (!currentBooking?.confirmation_code) return
    try {
      const updated = await BookingsService.getBookingByConfirmationCode({
        confirmationCode: currentBooking.confirmation_code,
      })
      setCurrentBooking(updated)
    } catch {
      // Keep current data on refetch error
    }
  }

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft"
      case "confirmed":
        return "Confirmed"
      case "checked_in":
        return "Checked In"
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      default:
        return "Unknown"
    }
  }

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="lg" mb={2}>
          Check-In Management
        </Heading>
      </Box>

      <Card.Root>
        <Card.Header>
          <Heading size="md">Look Up Booking</Heading>
        </Card.Header>
        <Card.Body>
          <VStack gap={4} align="stretch">
            <Box>
              <Text fontWeight="medium" mb={2}>
                Confirmation Code
              </Text>
              <HStack gap={2}>
                <Input
                  placeholder="Enter confirmation code"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleLookupBooking()}
                />
                <Button
                  colorPalette="blue"
                  onClick={handleLookupBooking}
                  loading={lookupBookingMutation.isPending}
                >
                  <FiSearch />
                  Look Up
                </Button>
              </HStack>
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>

      {currentBooking && (
        <>
          <Card.Root>
            <Card.Header>
              <HStack
                justify="space-between"
                align="center"
                flexWrap="wrap"
                gap={3}
              >
                <HStack gap={2} align="center">
                  <Heading size="2xl">Booking Details</Heading>
                  <Badge
                    colorPalette={getStatusColor(
                      currentBooking.booking_status || "unknown",
                    )}
                  >
                    {getStatusText(currentBooking.booking_status || "unknown")}
                  </Badge>
                  {isPartiallyRefunded(currentBooking) && (
                    <Text fontSize="sm" color="text.muted">
                      Refunded ${formatCents(getRefundedCents(currentBooking))}
                    </Text>
                  )}
                </HStack>
                <HStack gap={2} flexWrap="wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={checkInMutation.isPending}
                  >
                    <FiX />
                    Reset
                  </Button>
                  {currentBooking.booking_status !== "checked_in" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditOpen(true)}
                      disabled={checkInMutation.isPending}
                    >
                      <FiEdit />
                      Edit Booking
                    </Button>
                  )}
                  {currentBooking.booking_status === "confirmed" && (
                    <Button
                      colorPalette="green"
                      size="sm"
                      onClick={handleCheckIn}
                      loading={checkInMutation.isPending}
                    >
                      <FiCheck />
                      Check In
                    </Button>
                  )}
                  {currentBooking.booking_status === "checked_in" && (
                    <Button
                      variant="outline"
                      colorPalette="orange"
                      size="sm"
                      onClick={() =>
                        revertCheckInMutation.mutate({
                          code: confirmationCode,
                        })
                      }
                      loading={revertCheckInMutation.isPending}
                      title="Revert check-in so the booking is confirmed again"
                    >
                      <FiCornerUpLeft />
                      Revert Check-in
                    </Button>
                  )}
                </HStack>
              </HStack>
            </Card.Header>
            <Separator mt={6} />
            <Card.Body>
              <Grid
                templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                gap={6}
                mb={6}
              >
                <VStack gap={4} align="stretch">
                  <Box>
                    <Heading size="lg" mb={2}>
                      Customer Information
                    </Heading>
                    <Text>
                      <strong>Name:</strong> {currentBooking.user_name}
                    </Text>
                    <Text>
                      <strong>Email:</strong> {currentBooking.user_email}
                    </Text>
                    <Text>
                      <strong>Phone:</strong>{" "}
                      {currentBooking.user_phone || "Not provided"}
                    </Text>
                  </Box>

                  <Box>
                    <Heading size="lg" mb={2}>
                      Booking Information
                    </Heading>
                    <Text>
                      <strong>Confirmation Code:</strong>{" "}
                      {currentBooking.confirmation_code}
                    </Text>
                    <Text>
                      <strong>Total Amount:</strong> $
                      {formatCents(currentBooking.total_amount)}
                    </Text>
                    <Text>
                      <strong>Created:</strong>{" "}
                      {new Date(currentBooking.created_at).toLocaleDateString()}
                    </Text>
                  </Box>
                </VStack>

                <Box>
                  <Heading size="lg" mb={2}>
                    Booking Items
                  </Heading>
                  {currentBooking.items && currentBooking.items.length > 0 ? (
                    <VStack gap={2} align="stretch">
                      {currentBooking.items.map((item, index) => (
                        <Box key={index} p={3} bg="bg.muted" borderRadius="md">
                          <Text>
                            <strong>{item.item_type}</strong> x {item.quantity}
                          </Text>
                          <Text fontSize="sm" color="text.muted">
                            ${formatCents(item.price_per_unit)} each
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Text color="text.muted">No items</Text>
                  )}
                </Box>

                {currentBooking.items && currentBooking.items.length > 0 && (
                  <Box gridColumn={{ base: "1", md: "1 / -1" }}>
                    <BookingExperienceDetails
                      booking={currentBooking}
                      usePublicApis={false}
                      heading="Mission, launch & trip"
                    />
                  </Box>
                )}
              </Grid>
            </Card.Body>
          </Card.Root>

          <EditBooking
            booking={currentBooking}
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["bookings"] })
              void refetchCurrentBooking()
            }}
          />
        </>
      )}
    </VStack>
  )
}

export default CheckInInterface
