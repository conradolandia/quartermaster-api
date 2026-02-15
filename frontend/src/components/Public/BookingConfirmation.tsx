import {
  Box,
  Separator,
  Image,
  Button,
  Flex,
  Heading,
  Link,
  Text,
  VStack,
  Container,
  Span,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FiMail, FiPrinter } from "react-icons/fi"

import { BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import { StarFleetTipLabel } from "@/components/Common/StarFleetTipLabel"
import PublicBookingItemsList from "@/components/Public/PublicBookingItemsList"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import useCustomToast from "@/hooks/useCustomToast"
import { formatCents, formatDateTimeInLocationTz } from "@/utils"

import QMLogo from "/assets/images/qm-logo.svg"
import SFLogo from "/assets/images/sf-logo.svg"

interface BookingConfirmationProps {
  confirmationCode?: string
}

const BookingConfirmation = ({
  confirmationCode,
}: BookingConfirmationProps) => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  useDateFormatPreference()
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
    <Box
      maxW="xl"
      mx="auto"
      py={{ base: 4, md: 8 }}
      px={{ base: 4, md: 0 }}
      className="print-ticket-content"
    >
      <VStack gap={8} align="stretch">
        {/* Header */}
        <Flex alignItems="center" flexDirection="column" gap={4}>
          <Heading
            fontFamily="logo"
            size={{ base: "3xl", md: "5xl" }}
            fontWeight="400"
          >
            Star<Span color="dark.accent.primary">✦</Span>Fleet Tours
          </Heading>
          <Heading size="2xl" color="green.200">
            Booking Confirmed!
          </Heading>
          <Text color="gray.200" fontSize="lg">
            Your Star Fleet trip has been successfully booked!
          </Text>
          <Text fontSize="sm" color="gray.400" textAlign="center">
            A confirmation email has been sent to {booking.user_email}. <br />
            Please check your inbox for the details.
          </Text>
          <Text fontSize="sm" color="gray.400" textAlign="center">
            If you don't see the email, please check your spam folder. <br />
            If you still don't see the email, please contact us at <br />
            <Link color="blue.200" href="mailto:fleetcommand@star-fleet.tours">fleetcommand@star-fleet.tours</Link>.
          </Text>
        </Flex>

        {/* QR Code Ticket - above other sections */}
        <Box
          p={6}
          border="1px"
          borderColor="gray.200"
          borderRadius="md"
          className="print-qr-block"
        >
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
          <Box
            bg="dark.bg.secondary"
            borderRadius="lg"
            boxShadow="lg"
            p={{ base: 4, md: 8 }}
            className="print-booking-details"
          >
            <Image src={SFLogo} alt="Star Fleet Tours" maxW="320px" p={2} mx="auto" mb={4} />
            <Heading size="sm" mb={4}>
              Booking Information
            </Heading>
            <Separator mb={4} />
            <VStack gap={3} align="stretch">
              <Flex
                direction={{ base: "column", sm: "row" }}
                justify={{ sm: "space-between" }}
                gap={1}
                align={{ base: "stretch", sm: "center" }}
              >
                <Text fontWeight="medium">Confirmation Code:</Text>
                <Text fontFamily="mono" fontWeight="bold" wordBreak="break-all">
                  {booking.confirmation_code}
                </Text>
              </Flex>

              <Flex
                direction={{ base: "column", sm: "row" }}
                justify={{ sm: "space-between" }}
                gap={1}
                align={{ base: "stretch", sm: "center" }}
              >
                <Text fontWeight="medium">Customer:</Text>
                <Text wordBreak="break-word">
                  {[booking.first_name, booking.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              </Flex>

              <Flex
                direction={{ base: "column", sm: "row" }}
                justify={{ sm: "space-between" }}
                gap={1}
                align={{ base: "stretch", sm: "center" }}
              >
                <Text fontWeight="medium">Email:</Text>
                <Text wordBreak="break-all">
                  {booking.user_email?.replace(/(.{2}).*(@.*)/, "$1***$2")}
                </Text>
              </Flex>

              <Flex
                direction={{ base: "column", sm: "row" }}
                justify={{ sm: "space-between" }}
                gap={1}
                align={{ base: "stretch", sm: "center" }}
              >
                <Text fontWeight="medium">Phone:</Text>
                <Text>
                  {booking.user_phone?.replace(/(.{3}).*(.{3})/, "$1***$2")}
                </Text>
              </Flex>

              <Flex
                direction={{ base: "column", sm: "row" }}
                justify={{ sm: "space-between" }}
                gap={1}
                align={{ base: "stretch", sm: "center" }}
              >
                <Text fontWeight="medium">Booking Date:</Text>
                <Text>{formatDateTimeInLocationTz(booking.created_at, null)}</Text>
              </Flex>

              {booking.items && booking.items.length > 0 && (
                <BookingExperienceDetails
                  booking={booking}
                  usePublicApis
                  heading="Launch and trip details"
                  boxProps={{ mt: 6 }}
                />
              )}

              {booking.items && booking.items.length > 0 && (
                <PublicBookingItemsList items={booking.items} boxProps={{ mt: 6 }} />
              )}

              <Heading size="xl" mb={4} mt={6}>
                Order summary
              </Heading>
              <Separator mb={4} />
              <VStack gap={3} align="stretch">
                <Flex justify="space-between" align="center" gap={2}>
                  <Text fontWeight="medium">Subtotal:</Text>
                  <Text>${formatCents(booking.subtotal)}</Text>
                </Flex>
                {booking.discount_code && (
                  <Flex justify="space-between" align="center" gap={2}>
                    <Text fontWeight="medium">Discount Code:</Text>
                    <Text fontStyle="italic">{booking.discount_code.code}</Text>
                  </Flex>
                )}
                {booking.discount_amount > 0 && (
                  <Flex justify="space-between" align="center" gap={2}>
                    <Text fontWeight="medium">Discount:</Text>
                    <Text color="green.300">
                      -${formatCents(booking.discount_amount)}
                    </Text>
                  </Flex>
                )}
                <Flex justify="space-between" align="center" gap={2}>
                  <Text fontWeight="medium">Tax:</Text>
                  <Text>${formatCents(booking.tax_amount)}</Text>
                </Flex>
                {booking.tip_amount > 0 && (
                  <Flex justify="space-between" align="center" gap={2}>
                    <StarFleetTipLabel showColon />
                    <Text>${formatCents(booking.tip_amount)}</Text>
                  </Flex>
                )}
                <Flex
                  justify="space-between"
                  align="center"
                  gap={2}
                  borderTop="1px solid"
                  borderColor="gray.200"
                  pt={2}
                >
                  <Text fontWeight="bold">Total:</Text>
                  <Text fontWeight="bold">
                    ${formatCents(booking.total_amount)}
                  </Text>
                </Flex>
              </VStack>
            </VStack>
          </Box>

          <Box
            p={6}
            border="1px"
            borderColor="gray.200"
            borderRadius="md"
            className="no-print"
          >
            <Heading size="sm" mb={4}>
              Actions
            </Heading>
            <VStack gap={3} align="stretch">
              <Button
                onClick={handlePrint}
                variant="outline"
                size={{ base: "lg", sm: "md" }}
                w={{ base: "100%", sm: "auto" }}
              >
                <FiPrinter /> Print Tickets
              </Button>

              <Button
                onClick={handleEmail}
                variant="outline"
                size={{ base: "lg", sm: "md" }}
                w={{ base: "100%", sm: "auto" }}
                loading={emailSending}
                disabled={emailSending}
              >
                <FiMail /> Resend Email
              </Button>
            </VStack>
          </Box>

          <Box
            p={6}
            border="1px"
            borderColor="gray.200"
            borderRadius="md"
            className="no-print"
          >
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
        <Box textAlign="center" pt={4} className="no-print">
          <Text fontSize="sm" color="gray.400">
            Need help? Contact us at{" "}
            <Link color="blue.200" href="mailto:fleetcommand@star-fleet.tours">
              fleetcommand@star-fleet.tours
            </Link>
          </Text>
        </Box>
        <Container
          maxW="container.lg"
          display="flex"
          justifyContent="center"
          className="no-print"
        >
          <VStack gap={4}>
            <Text fontSize="sm" color="whiteAlpha.700">
              Powered by
            </Text>
            <Image src={QMLogo} alt="Logo" maxW="200px" />
          </VStack>
        </Container>
      </VStack>
    </Box>
  )
}

export default BookingConfirmation
