import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  HStack,
  Heading,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { FiCheck, FiCornerUpLeft, FiEdit, FiExternalLink, FiSearch } from "react-icons/fi"

import { type BookingPublic, BookingsService } from "@/client"
import BookingExperienceDetails from "@/components/Bookings/BookingExperienceDetails"
import EditBooking from "@/components/Bookings/EditBooking"
import {
  getRefundedCents,
  isPartiallyRefunded,
} from "@/components/Bookings/types"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { isAdmin } from "@/utils/permissions"
import { formatCents } from "@/utils"

const DetailRow = ({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) => (
  <Flex gap={4} alignItems="baseline">
    <Text fontWeight="bold" minW="100px" fontSize="sm">
      {label}:
    </Text>
    <Text fontSize="sm">{value}</Text>
  </Flex>
)

interface CheckInInterfaceProps {
  /** When set (e.g. from URL ?code=), load this booking on mount. Used by QR scan flow. */
  initialCode?: string
  /** When true (QR with ?check_in=true), check in automatically after lookup if confirmed. */
  autoCheckIn?: boolean
  onBookingCheckedIn?: (booking: BookingPublic) => void
  /** Called after auto check-in completes (e.g. strip check_in from URL). */
  onAutoCheckInComplete?: () => void
}

const CheckInInterface = ({
  initialCode,
  autoCheckIn = false,
  onBookingCheckedIn,
  onAutoCheckInComplete,
}: CheckInInterfaceProps) => {
  useDateFormatPreference()
  const [confirmationCode, setConfirmationCode] = useState("")
  const [currentBooking, setCurrentBooking] = useState<BookingPublic | null>(
    null,
  )
  const [isEditOpen, setIsEditOpen] = useState(false)

  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManageBookings = isAdmin(user)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const qrLoadAttemptedRef = useRef<string | null>(null)
  const onAutoCheckInCompleteRef = useRef(onAutoCheckInComplete)
  const onBookingCheckedInRef = useRef(onBookingCheckedIn)
  const showSuccessToastRef = useRef(showSuccessToast)
  const showErrorToastRef = useRef(showErrorToast)

  useEffect(() => {
    onAutoCheckInCompleteRef.current = onAutoCheckInComplete
    onBookingCheckedInRef.current = onBookingCheckedIn
    showSuccessToastRef.current = showSuccessToast
    showErrorToastRef.current = showErrorToast
  })

  const getApiErrorDetail = (error: unknown, fallback: string): string => {
    const detail = (error as { body?: { detail?: string } })?.body?.detail
    return typeof detail === "string" ? detail : fallback
  }

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
    onError: (error: unknown) => {
      showErrorToast(getApiErrorDetail(error, "Failed to find booking"))
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
    onError: (error: unknown) => {
      showErrorToast(getApiErrorDetail(error, "Failed to check in booking"))
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
    onError: (error: unknown) => {
      showErrorToast(getApiErrorDetail(error, "Failed to revert check-in"))
    },
  })

  // Load booking when opened with ?code= (e.g. from QR scan); optional auto check-in
  useEffect(() => {
    const code = initialCode?.trim()
    if (!code) return
    const loadKey = `${code}:${autoCheckIn}`
    if (qrLoadAttemptedRef.current === loadKey) return
    qrLoadAttemptedRef.current = loadKey

    setConfirmationCode(code)
    let cancelled = false

    void (async () => {
      try {
        const booking = await BookingsService.getBookingByConfirmationCode({
          confirmationCode: code,
        })
        if (cancelled) return
        setCurrentBooking(booking)

        if (!autoCheckIn) {
          showSuccessToastRef.current("Booking found successfully")
          return
        }

        const status = (booking.booking_status ?? "").toLowerCase()
        if (status === "checked_in") {
          showSuccessToastRef.current("Already checked in")
          onAutoCheckInCompleteRef.current?.()
          return
        }
        if (status !== "confirmed") {
          showErrorToastRef.current(
            `Cannot check in booking with status '${booking.booking_status}'. Booking must be 'confirmed'.`,
          )
          return
        }

        const checkedIn = await BookingsService.checkInBooking({
          confirmationCode: code,
        })
        if (cancelled) return
        setCurrentBooking(checkedIn)
        showSuccessToastRef.current("Booking checked in successfully!")
        onBookingCheckedInRef.current?.(checkedIn)
        queryClient.invalidateQueries({ queryKey: ["bookings"] })
        onAutoCheckInCompleteRef.current?.()
      } catch (error: unknown) {
        if (cancelled) return
        showErrorToastRef.current(getApiErrorDetail(error, "Failed to load booking"))
        setCurrentBooking(null)
      }
    })()

    return () => {
      cancelled = true
      if (qrLoadAttemptedRef.current === loadKey) {
        qrLoadAttemptedRef.current = null
      }
    }
  }, [initialCode, autoCheckIn, queryClient])

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
      <Box display={{ base: "none", md: "block" }}>
        <Heading size="lg" mb={2}>
          Check-In Management
        </Heading>
      </Box>

      {!initialCode?.trim() && (
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
                <Flex
                  gap={2}
                  flexDirection={{ base: "column", sm: "row" }}
                  align={{ base: "stretch", sm: "center" }}
                >
                  <Input
                    placeholder="Enter confirmation code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleLookupBooking()
                    }
                  />
                  <Button
                    colorPalette="blue"
                    onClick={handleLookupBooking}
                    loading={lookupBookingMutation.isPending}
                  >
                    <FiSearch />
                    Look Up
                  </Button>
                </Flex>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}

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
                  {canManageBookings && (
                    <Button variant="outline" size={{ base: "xs", md: "sm" }} asChild>
                      <RouterLink
                        to="/bookings"
                        search={{ code: currentBooking.confirmation_code }}
                      >
                        <FiExternalLink />
                        Full Details
                      </RouterLink>
                    </Button>
                  )}
                  {canManageBookings &&
                    currentBooking.booking_status !== "checked_in" && (
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
                      size={{ base: "xs", md: "sm" }}
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
            <Card.Body>
              <Grid
                templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                gap={6}
              >
                <VStack gap={4} align="stretch">
                  <Box>
                    <Heading size="lg" mb={4}>
                      Booking Information
                    </Heading>
                    <VStack align="stretch" gap={3}>
                      <DetailRow
                        label="Name"
                        value={[currentBooking.first_name, currentBooking.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      />
                      <DetailRow
                        label="Confirmation"
                        value={currentBooking.confirmation_code}
                      />
                    </VStack>
                  </Box>

                  {currentBooking.items && currentBooking.items.length > 0 && (
                    <BookingExperienceDetails
                      booking={currentBooking}
                      usePublicApis={false}
                      heading="Trip Information"
                      variant="checkIn"
                      showSeparator={false}
                    />
                  )}
                </VStack>

                <Box>
                  <Heading size="lg" mb={4}>
                    Booking Items
                  </Heading>
                  {currentBooking.items && currentBooking.items.length > 0 ? (
                    <VStack gap={2} align="stretch">
                      {currentBooking.items.map((item, index) => (
                        <Box key={index} p={3} bg="bg.muted" borderRadius="md">
                          <Text>
                            <strong>{item.item_type}</strong> x {item.quantity}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Text color="text.muted">No items</Text>
                  )}
                </Box>
              </Grid>
            </Card.Body>
          </Card.Root>

          {canManageBookings && (
            <EditBooking
              booking={currentBooking}
              isOpen={isEditOpen}
              onClose={() => setIsEditOpen(false)}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["bookings"] })
                void refetchCurrentBooking()
              }}
            />
          )}
        </>
      )}
    </VStack>
  )
}

export default CheckInInterface
