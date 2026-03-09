import { Badge, Box, Flex, Heading, Text, VStack } from "@chakra-ui/react"

import type { BookingPublic } from "@/client"
import { formatCents, formatDateTimeInLocationTz } from "@/utils"
import {
  formatPaymentStatusLabel,
  getBookingStatusColor,
  getPaymentStatusColor,
  getRefundedCents,
} from "./types"

interface BookingDetailInfoSectionsProps {
  booking: BookingPublic
  userTz: string
}

export default function BookingDetailInfoSections({
  booking,
  userTz,
}: BookingDetailInfoSectionsProps) {
  return (
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
              <Box className="print-admin-qr-block">
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
                <Text>
                  {formatDateTimeInLocationTz(booking.created_at, userTz)}
                </Text>
              </Flex>
              {booking.updated_at && (
                <Flex gap={4} mb={2} alignItems="baseline">
                  <Text fontWeight="bold">Last Updated:</Text>
                  <Text>
                    {formatDateTimeInLocationTz(booking.updated_at, userTz)}
                  </Text>
                </Flex>
              )}
              {(() => {
                const hasRefund =
                  booking.payment_status === "refunded" ||
                  booking.payment_status === "partially_refunded" ||
                  getRefundedCents(booking) > 0
                if (!hasRefund) return null
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
              <Text
                color="text.muted"
                fontStyle={booking.admin_notes ? "normal" : "italic"}
              >
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
  )
}
