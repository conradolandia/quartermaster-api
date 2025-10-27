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
import { useState } from "react"
import { FiSearch } from "react-icons/fi"

import { BookingsService, type BookingPublic } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"

const BookingLookup = () => {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [lastName, setLastName] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [currentBooking, setCurrentBooking] = useState<BookingPublic | null>(null)

  const { showSuccessToast, showErrorToast } = useCustomToast()

  const handleLookup = async () => {
    if (!confirmationCode.trim() || !lastName.trim()) {
      showErrorToast("Please enter both confirmation code and last name")
      return
    }

    try {
      setIsSearching(true)
      const booking = await BookingsService.getBookingByConfirmationCode({
        confirmationCode: confirmationCode.trim().toUpperCase(),
      })

      // Verify last name matches (case-insensitive)
      const bookingLastName = booking.user_name.split(" ").pop()?.toLowerCase() || ""
      const inputLastName = lastName.trim().toLowerCase()

      if (bookingLastName !== inputLastName) {
        showErrorToast("Last name does not match the booking")
        setCurrentBooking(null)
        return
      }

      setCurrentBooking(booking)
      showSuccessToast("Booking found successfully")
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.detail || "Booking not found. Please check your confirmation code and last name.",
      )
      setCurrentBooking(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleReset = () => {
    setConfirmationCode("")
    setLastName("")
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
      case "pending_payment":
        return "yellow"
      default:
        return "gray"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <VStack gap={6} align="stretch" maxW="2xl" mx="auto">
      <Box textAlign="center">
        <Heading size="lg" mb={2}>
          Look Up Your Booking
        </Heading>
        <Text color="text.muted">
          Enter your confirmation code and last name to view your booking details
        </Text>
      </Box>

      {/* Search Form */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={4} align="stretch">
            <VStack gap={4} align="stretch">
              <Box>
                <Text fontWeight="medium" mb={2}>
                  Confirmation Code
                </Text>
                <Input
                  placeholder="Enter your confirmation code (e.g., ABC12345)"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === "Enter" && handleLookup()}
                />
              </Box>
              <Box>
                <Text fontWeight="medium" mb={2}>
                  Last Name
                </Text>
                <Input
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleLookup()}
                />
              </Box>
            </VStack>

            <HStack gap={4} justify="center">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isSearching}
              >
                Clear
              </Button>
              <Button
                colorPalette="blue"
                onClick={handleLookup}
                loading={isSearching}
                disabled={!confirmationCode.trim() || !lastName.trim()}
              >
                <FiSearch />
                Look Up Booking
              </Button>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Booking Details */}
      {currentBooking && (
        <Card.Root bg="bg.panel">
          <Card.Body>
            <VStack gap={6} align="stretch">
              <HStack justify="space-between" align="center">
                <Heading size="md">Booking Details</Heading>
                <Badge colorPalette={getStatusColor(currentBooking.status || "unknown")} size="lg">
                  {(currentBooking.status || "unknown").replace("_", " ").toUpperCase()}
                </Badge>
              </HStack>

              {/* Customer Information */}
              <Box>
                <Heading size="sm" mb={3} color="text.muted">
                  Customer Information
                </Heading>
                <VStack gap={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Name:</Text>
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
                    <Text fontWeight="medium">Confirmation Code:</Text>
                    <Text fontFamily="mono" fontWeight="bold">
                      {currentBooking.confirmation_code}
                    </Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Booking Items */}
              {currentBooking.items && currentBooking.items.length > 0 && (
                <Box>
                  <Heading size="sm" mb={3} color="text.muted">
                    Booking Items
                  </Heading>
                  <VStack gap={2} align="stretch">
                    {currentBooking.items.map((item, index) => (
                      <HStack key={index} justify="space-between" p={3} bg="gray.50" borderRadius="md">
                        <VStack align="start" gap={1}>
                          <Text fontWeight="medium">
                            {item.quantity}x {item.item_type.replace("_", " ")}
                          </Text>
                          <Text fontSize="sm" color="text.muted">
                            ${item.price_per_unit.toFixed(2)} each
                          </Text>
                        </VStack>
                        <VStack align="end" gap={1}>
                          <Badge colorPalette={item.status === "fulfilled" ? "green" : item.status === "refunded" ? "orange" : "blue"}>
                            {item.status}
                          </Badge>
                          <Text fontWeight="bold">
                            ${(item.quantity * item.price_per_unit).toFixed(2)}
                          </Text>
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Pricing Summary */}
              <Box>
                <Heading size="sm" mb={3} color="text.muted">
                  Pricing Summary
                </Heading>
                <VStack gap={2} align="stretch">
                  <HStack justify="space-between">
                    <Text>Subtotal:</Text>
                    <Text>${currentBooking.subtotal.toFixed(2)}</Text>
                  </HStack>
                  {currentBooking.discount_amount > 0 && (
                    <HStack justify="space-between">
                      <Text color="green.600">Discount:</Text>
                      <Text color="green.600">-${currentBooking.discount_amount.toFixed(2)}</Text>
                    </HStack>
                  )}
                  <HStack justify="space-between">
                    <Text>Tax:</Text>
                    <Text>${currentBooking.tax_amount.toFixed(2)}</Text>
                  </HStack>
                  {currentBooking.tip_amount > 0 && (
                    <HStack justify="space-between">
                      <Text>Tip:</Text>
                      <Text>${currentBooking.tip_amount.toFixed(2)}</Text>
                    </HStack>
                  )}
                  <HStack justify="space-between" borderTop="1px solid" borderColor="gray.200" pt={2}>
                    <Text fontWeight="bold" fontSize="lg">Total:</Text>
                    <Text fontWeight="bold" fontSize="lg">${currentBooking.total_amount.toFixed(2)}</Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Booking Information */}
              <Box>
                <Heading size="sm" mb={3} color="text.muted">
                  Booking Information
                </Heading>
                <VStack gap={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Created:</Text>
                    <Text>{formatDate(currentBooking.created_at)}</Text>
                  </HStack>
                  {currentBooking.special_requests && (
                    <Box>
                      <Text fontWeight="medium" mb={1}>Special Requests:</Text>
                      <Text fontSize="sm" color="text.muted" p={2} bg="gray.50" borderRadius="md">
                        {currentBooking.special_requests}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Actions */}
              <HStack gap={4} justify="center">
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  Look Up Another Booking
                </Button>
                {currentBooking.status === "confirmed" && (
                  <Button
                    colorPalette="blue"
                    onClick={() => {
                      // In a real app, this would open the QR code or check-in page
                      showSuccessToast("QR code functionality would be available here")
                    }}
                  >
                    View QR Code
                  </Button>
                )}
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  )
}

export default BookingLookup
