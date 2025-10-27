import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Heading,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCheck, FiSearch, FiX } from "react-icons/fi"

import {
  BookingsService,
  type BookingPublic,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"

interface CheckInInterfaceProps {
  onBookingCheckedIn?: (booking: BookingPublic) => void
}

const CheckInInterface = ({ onBookingCheckedIn }: CheckInInterfaceProps) => {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [currentBooking, setCurrentBooking] = useState<BookingPublic | null>(null)

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
      showErrorToast(
        error?.response?.data?.detail || "Failed to find booking",
      )
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

  const handleLookupBooking = () => {
    if (!confirmationCode.trim()) {
      showErrorToast("Please enter a confirmation code")
      return
    }
    lookupBookingMutation.mutate(confirmationCode.trim())
  }

  const handleCheckIn = () => {
    if (!currentBooking) return
    checkInMutation.mutate({ code: confirmationCode })
  }

  const handleReset = () => {
    setConfirmationCode("")
    setCurrentBooking(null)
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
      case "confirmed":
        return "Confirmed"
      case "checked_in":
        return "Checked In"
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      case "refunded":
        return "Refunded"
      default:
        return "Unknown"
    }
  }

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="lg" mb={2}>
          Check-In Interface
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
        <Card.Root>
          <Card.Header>
            <HStack justify="space-between">
              <Heading size="md">Booking Details</Heading>
              <Badge colorPalette={getStatusColor(currentBooking.status || "unknown")}>
                {getStatusText(currentBooking.status || "unknown")}
              </Badge>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap={4} align="stretch">
              <Box>
                <Text fontWeight="medium" mb={2}>
                  Customer Information
                </Text>
                <Text>
                  <strong>Name:</strong> {currentBooking.user_name}
                </Text>
                <Text>
                  <strong>Email:</strong> {currentBooking.user_email}
                </Text>
                <Text>
                  <strong>Phone:</strong> {currentBooking.user_phone || "Not provided"}
                </Text>
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Booking Information
                </Text>
                <Text>
                  <strong>Confirmation Code:</strong> {currentBooking.confirmation_code}
                </Text>
                <Text>
                  <strong>Total Amount:</strong> ${currentBooking.total_amount?.toFixed(2)}
                </Text>
                <Text>
                  <strong>Created:</strong> {new Date(currentBooking.created_at).toLocaleDateString()}
                </Text>
              </Box>

              {currentBooking.items && currentBooking.items.length > 0 && (
                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Booking Items
                  </Text>
                  <VStack gap={2} align="stretch">
                    {currentBooking.items.map((item, index) => (
                      <Box key={index} p={3} bg="bg.muted" borderRadius="md">
                        <Text>
                          <strong>{item.item_type}</strong> x {item.quantity}
                        </Text>
                        <Text fontSize="sm" color="text.muted">
                          ${item.price_per_unit?.toFixed(2)} each
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

              <HStack gap={4} justify="flex-end">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={checkInMutation.isPending}
                >
                  <FiX />
                  Reset
                </Button>
                <Button
                  colorPalette="green"
                  onClick={handleCheckIn}
                  loading={checkInMutation.isPending}
                  disabled={currentBooking.status === "checked_in"}
                >
                  <FiCheck />
                  {currentBooking.status === "checked_in" ? "Already Checked In" : "Check In"}
                </Button>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  )
}

export default CheckInInterface
