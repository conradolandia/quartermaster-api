import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FiArrowLeft, FiMail, FiPrinter } from "react-icons/fi";

import { BookingsService } from "@/client";
import BookingActionsMenu from "@/components/Common/BookingActionsMenu";
import { formatDate, getStatusColor } from "./types";

interface BookingDetailsProps {
  confirmationCode: string;
}

export default function BookingDetails({
  confirmationCode,
}: BookingDetailsProps) {
  const navigate = useNavigate();

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
  });

  const handleBack = () => {
    navigate({ search: {} });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = async () => {
    try {
      const response = await fetch(
        `/api/bookings/${confirmationCode}/resend-email`,
        {
          method: "POST",
        }
      );
      if (response.ok) {
        console.log("Email sent successfully");
      } else {
        console.error("Failed to resend email");
      }
    } catch (error) {
      console.error("Error resending email:", error);
    }
  };

  if (isLoading) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Text>Loading booking details...</Text>
        </VStack>
      </Container>
    );
  }

  if (error || !booking) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Icon as={FiArrowLeft} boxSize={8} color="red.500" />
          <Text fontSize="lg" fontWeight="bold">
            Booking Not Found
          </Text>
          <Text color="gray.600">
            No booking found with confirmation code: {confirmationCode}
          </Text>
          <Button onClick={handleBack}>Back to Bookings</Button>
        </VStack>
      </Container>
    );
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
          <Button size="sm" variant="ghost" onClick={handleEmail}>
            <Flex align="center" gap={2}>
              <FiMail />
              Resend Email
            </Flex>
          </Button>
          <BookingActionsMenu booking={booking} />
        </Flex>
      </Flex>

      <VStack align="stretch" gap={6}>
        <Flex gap={6} direction={{ base: "column", lg: "row" }}>
          <Box flex="1">
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
                <Box>
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Status:</Text>
                    <Badge colorScheme={getStatusColor(booking.status || "")}>
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
                {booking.qr_code_base64 && (
                  <Box>
                    <img
                      src={`data:image/png;base64,${booking.qr_code_base64}`}
                      alt="Booking QR Code"
                      style={{ maxWidth: "150px", height: "auto" }}
                    />
                  </Box>
                )}
              </Flex>
            </Box>
          </Box>

          <Box flex="1">
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
              <Flex gap={4} mb={2} alignItems="baseline">
                <Text fontWeight="bold">Name:</Text>
                <Text>{booking.user_name}</Text>
              </Flex>
              <Flex gap={4} mb={2} alignItems="baseline">
                <Text fontWeight="bold">Email:</Text>
                <Text>{booking.user_email}</Text>
              </Flex>
              {booking.user_phone && (
                <Flex gap={4} mb={2} alignItems="baseline">
                  <Text fontWeight="bold">Phone:</Text>
                  <Text>{booking.user_phone}</Text>
                </Flex>
              )}
            </Box>
          </Box>
        </Flex>

        <Box>
          <Heading size="md" mb={4}>
            Booking Items
          </Heading>
          {booking.items && booking.items.length > 0 ? (
            <Box overflowX="auto">
              <Table.Root size={{ base: "sm", md: "md" }}>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Item Type</Table.ColumnHeader>
                    <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                    <Table.ColumnHeader>Price per Unit</Table.ColumnHeader>
                    <Table.ColumnHeader>Total</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {booking.items.map((item, index) => (
                    <Table.Row key={index}>
                      <Table.Cell>
                        {item.item_type
                          .replace("_", " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Table.Cell>
                      <Table.Cell>{item.quantity}</Table.Cell>
                      <Table.Cell>
                        ${item.price_per_unit?.toFixed(2) || "0.00"}
                      </Table.Cell>
                      <Table.Cell>
                        $
                        {((item.price_per_unit || 0) * item.quantity).toFixed(
                          2
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          ) : (
            <Text color="gray.500">No items found for this booking.</Text>
          )}
        </Box>
      </VStack>
    </Container>
  );
}
