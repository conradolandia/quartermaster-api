import {
  Box,
  Button,
  HStack,
  Heading,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import { FiMail, FiPrinter } from "react-icons/fi"

import { BookingsService } from "@/client"

const BookingConfirmation = () => {
  const { confirmationCode } = useSearch({ from: "/book-confirm" })

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["booking", confirmationCode],
    queryFn: () =>
      BookingsService.getBookingByConfirmationCode({
        confirmationCode: confirmationCode || "",
      }),
    enabled: !!confirmationCode,
  })

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Loading booking details...</Text>
      </Box>
    )
  }

  if (error || !booking) {
    return (
      <Box textAlign="center" py={8}>
        <Box
          p={4}
          bg="red.50"
          border="1px"
          borderColor="red.200"
          borderRadius="md"
        >
          <Text color="red.800">
            Failed to load booking details. Please check your confirmation link.
          </Text>
        </Box>
      </Box>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const handleEmail = async () => {
    if (!confirmationCode) return

    try {
      const response = await fetch(
        `/api/bookings/${confirmationCode}/resend-email`,
        {
          method: "POST",
        },
      )
      if (response.ok) {
        console.log("Email sent successfully")
        // You could show a success toast here
      } else {
        console.error("Failed to resend email")
        // You could show an error toast here
      }
    } catch (error) {
      console.error("Error resending email:", error)
    }
  }

  return (
    <Box maxW="xl" mx="auto" py={8}>
      <VStack gap={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading size="lg" mb={2} color="green.300">
            Booking Confirmed!
          </Heading>
          <Text color="gray.200">
            Your rocket launch experience has been successfully booked.
          </Text>
        </Box>

        <VStack gap={6} align="stretch">
          {/* Booking Details */}
          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Booking Information
            </Heading>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="medium">Confirmation Code:</Text>
                <Text fontFamily="mono" fontWeight="bold">
                  {booking.confirmation_code}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Customer:</Text>
                <Text>{booking.user_name}</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Email:</Text>
                <Text>
                  {booking.user_email?.replace(/(.{2}).*(@.*)/, "$1***$2")}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Phone:</Text>
                <Text>
                  {booking.user_phone?.replace(/(.{3}).*(.{3})/, "$1***$2")}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Booking Date:</Text>
                <Text>{new Date(booking.created_at).toLocaleDateString()}</Text>
              </HStack>
            </VStack>
          </Box>

          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Trip Details
            </Heading>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="medium">Trip Type:</Text>
                <Text>Rocket Launch Experience</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Items:</Text>
                <Text>{booking.items?.length || 0} items</Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="medium">Total Amount:</Text>
                <Text fontWeight="bold">
                  ${booking.total_amount?.toFixed(2)}
                </Text>
              </HStack>
            </VStack>
          </Box>

          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Your QR Code Tickets
            </Heading>
            <VStack gap={4} align="stretch">
              {booking.items?.map((item: any, index: number) => (
                <Box
                  key={index}
                  textAlign="center"
                  p={4}
                  border="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                >
                  <Text fontWeight="medium" mb={2}>
                    {item.item_type
                      .replace("_", " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    {item.quantity > 1 && ` (${item.quantity})`}
                  </Text>
                  {item.qr_code_url && (
                    <Box>
                      <img
                        src={item.qr_code_url}
                        alt={`QR Code for ${item.item_type}`}
                        style={{ maxWidth: "200px", height: "auto" }}
                      />
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>

          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Actions
            </Heading>
            <VStack gap={3} align="stretch">
              <Button onClick={handlePrint} variant="outline">
                <FiPrinter /> Print Tickets
              </Button>

              <Button onClick={handleEmail} variant="outline">
                <FiMail /> Resend Email
              </Button>
            </VStack>
          </Box>

          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              What's Next?
            </Heading>
            <VStack gap={3} align="stretch">
              <Text fontSize="sm">
                • Check your email for detailed trip information
              </Text>
              <Text fontSize="sm">• Save or print your QR code tickets</Text>
              <Text fontSize="sm">
                • Arrive at the dock 30 minutes before departure
              </Text>
              <Text fontSize="sm">• Present your QR code for check-in</Text>
            </VStack>
          </Box>

          <Box
            p={4}
            bg="green.50"
            border="1px"
            borderColor="green.200"
            borderRadius="md"
          >
            <Text fontWeight="medium" color="green.800">
              Booking Confirmed!
            </Text>
            <Text fontSize="sm" color="green.700">
              A confirmation email has been sent to {booking.user_email}
            </Text>
          </Box>
        </VStack>

        {/* Footer */}
        <Box textAlign="center" pt={4}>
          <Text fontSize="sm" color="gray.600">
            Need help? Contact us at{" "}
            <Link color="blue.500" href="mailto:support@star-fleet.tours">
              support@star-fleet.tours
            </Link>
          </Text>
        </Box>
      </VStack>
    </Box>
  )
}

export default BookingConfirmation
