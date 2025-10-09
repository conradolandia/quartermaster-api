import {
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { FiPlus } from "react-icons/fi"
import { z } from "zod"

import AddBooking from "@/components/Bookings/AddBooking"
import BookingDetails from "@/components/Bookings/BookingDetails"
import BookingsTable from "@/components/Bookings/BookingsTable"
import BookingConfirmation from "@/components/Public/BookingConfirmation"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

// Search schema for the route
const bookingsSearchSchema = z.object({
  code: z.string().optional(),
})

export const Route = createFileRoute("/_layout/bookings")({
  component: Bookings,
  validateSearch: (search) => bookingsSearchSchema.parse(search),
})

function Bookings() {
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false)
  const { code } = Route.useSearch()
  const { user } = useAuth()

  const handleAddBookingSuccess = () => {
    // This will trigger a refetch via the mutation's onSettled
  }

  // If a confirmation code is provided, show the appropriate view based on authentication
  if (code) {
    // If user is authenticated and has user data, show the internal admin view
    if (isLoggedIn() && user !== undefined && user !== null) {
      return <BookingDetails confirmationCode={code} />
    }
    // If user is not authenticated, show the public confirmation view
    else {
      return <BookingConfirmation confirmationCode={code} />
    }
  }

  // If no confirmation code, require authentication for bookings management
  if (!isLoggedIn() || !user) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="400px">
          <Text fontSize="lg" fontWeight="bold">
            Authentication Required
          </Text>
          <Text color="gray.600">
            Please log in to access the bookings management system.
          </Text>
        </VStack>
      </Container>
    )
  }

  // Otherwise, show the normal bookings table for authenticated users
  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Bookings Management</Heading>
        <Button onClick={() => setIsAddBookingOpen(true)}>
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Booking</span>
          </Flex>
        </Button>
      </Flex>

      <BookingsTable onBookingClick={(confirmationCode) => {
        // Navigate to the booking details view
        window.history.pushState({}, "", `/bookings?code=${confirmationCode}`)
        window.location.reload()
      }} />

      <AddBooking
        isOpen={isAddBookingOpen}
        onClose={() => setIsAddBookingOpen(false)}
        onSuccess={handleAddBookingSuccess}
      />
    </Container>
  )
}
