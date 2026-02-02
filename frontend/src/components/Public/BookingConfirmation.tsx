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
import { useState } from "react"
import { FiMail, FiPrinter } from "react-icons/fi"

import { BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import PublicBookingItemsList from "@/components/Public/PublicBookingItemsList"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents } from "@/utils"

interface BookingConfirmationProps {
  confirmationCode?: string
}

const BookingConfirmation = ({
  confirmationCode,
}: BookingConfirmationProps) => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [emailSending, setEmailSending] = useState(false)
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

  return (
    <Box maxW="xl" mx="auto" py={8}>
      <VStack gap={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading size="lg" mb={2} color="green.300">
            Booking Confirmed!
          </Heading>
          <Text color="gray.200" mb={1}>
            Your Star Fleet experience has been successfully booked.
          </Text>
          <Text fontSize="sm" color="gray.400">
            A confirmation email has been sent to {booking.user_email}.
          </Text>
        </Box>

        {/* QR Code Ticket - above other sections */}
        <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
          <Heading size="sm" mb={4} textAlign="center">
            Your QR Code Ticket
          </Heading>
          <VStack gap={4} align="stretch">
            <Box textAlign="center">
              {booking.qr_code_base64 ? (
                <img
                  src={`data:image/png;base64,${booking.qr_code_base64}`}
                  alt={`QR Code for booking ${booking.confirmation_code}`}
                  style={{ width: "100%", height: "auto" }}
                />
              ) : (
                <Text fontSize="sm" color="gray.500">
                  QR code is not available yet. Please refresh this page in a
                  moment.
                </Text>
              )}
            </Box>
          </VStack>
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

          {booking.items && booking.items.length > 0 && (
            <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
              <BookingExperienceDetails
                booking={booking}
                usePublicApis
                heading="Launch and trip details"
              />
            </Box>
          )}

          {booking.items && booking.items.length > 0 && (
            <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
              <PublicBookingItemsList items={booking.items} />
            </Box>
          )}

          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Order summary
            </Heading>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="medium">Subtotal:</Text>
                <Text>${formatCents(booking.subtotal)}</Text>
              </HStack>
              {booking.discount_amount > 0 && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Discount:</Text>
                  <Text color="green.600">
                    -${formatCents(booking.discount_amount)}
                  </Text>
                </HStack>
              )}
              <HStack justify="space-between">
                <Text fontWeight="medium">Tax:</Text>
                <Text>${formatCents(booking.tax_amount)}</Text>
              </HStack>
              {booking.tip_amount > 0 && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Tip:</Text>
                  <Text>${formatCents(booking.tip_amount)}</Text>
                </HStack>
              )}
              <HStack
                justify="space-between"
                borderTop="1px solid"
                borderColor="gray.200"
                pt={2}
              >
                <Text fontWeight="bold">Total:</Text>
                <Text fontWeight="bold">
                  ${formatCents(booking.total_amount)}
                </Text>
              </HStack>
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

              <Button
                onClick={handleEmail}
                variant="outline"
                loading={emailSending}
                disabled={emailSending}
              >
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
