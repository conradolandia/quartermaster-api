import {
  Badge,
  Box,
  Card,
  Grid,
  HStack,
  Heading,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiDollarSign, FiUsers, FiTrendingUp, FiCalendar } from "react-icons/fi"

import { BookingsService, TripsService } from "@/client"
import { formatCents } from "@/utils"

interface DashboardStatsProps {
  selectedMissionId?: string
}

const DashboardStats = ({ selectedMissionId }: DashboardStatsProps) => {
  // Fetch all bookings for statistics
  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["bookings", selectedMissionId],
    queryFn: () =>
      BookingsService.listBookings({
        limit: 1000,
        missionId: selectedMissionId || undefined,
      }),
  })

  // Fetch trips for capacity calculations
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  const bookings = bookingsData?.data || []
  const trips = tripsData?.data || []

  // Extract trip boats from trips data
  const tripBoats = trips.flatMap(trip => trip.trip_boats || [])

  // Calculate statistics
  const stats = {
    totalBookings: bookings.length,
    totalRevenue: bookings
      .filter(booking =>
        ['confirmed', 'checked_in', 'completed'].includes(booking.status || '')
      )
      .reduce((sum, booking) => sum + booking.total_amount, 0),
    grossRevenue: bookings.reduce((sum, booking) => sum + booking.total_amount, 0),
    confirmedBookings: bookings.filter((b) => b.status === "confirmed").length,
    checkedInBookings: bookings.filter((b) => b.status === "checked_in").length,
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    cancelledBookings: bookings.filter((b) => b.status === "cancelled").length,
    refundedBookings: bookings.filter((b) => b.status === "refunded").length,
    totalPassengers: bookings.reduce((sum, booking) => {
      return sum + (booking.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0)
    }, 0),
  }

  // Calculate capacity utilization using actual boat capacity data
  // Calculate total capacity based on trip boats data
  const totalCapacity = tripBoats.reduce((sum, tripBoat) => {
    // Use max_capacity from trip_boat if available, otherwise use boat's capacity
    const capacity = tripBoat.max_capacity || tripBoat.boat.capacity
    return sum + capacity
  }, 0)

  const capacityUtilization = totalCapacity > 0 ? (stats.totalPassengers / totalCapacity) * 100 : 0

  // Calculate average booking value
  const averageBookingValue = stats.totalBookings > 0 ? stats.totalRevenue / stats.totalBookings : 0

  // Calculate conversion rate (confirmed vs total)
  const conversionRate = stats.totalBookings > 0 ? (stats.confirmedBookings / stats.totalBookings) * 100 : 0

  // Get recent bookings (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentBookings = bookings.filter((booking) =>
    new Date(booking.created_at) >= sevenDaysAgo
  )

  const recentRevenue = recentBookings.reduce((sum, booking) => sum + booking.total_amount, 0)

  if (isLoadingBookings) {
    return (
      <VStack gap={4} align="center" py={8}>
        <Spinner size="lg" />
        <Text>Loading dashboard statistics...</Text>
      </VStack>
    )
  }

  const StatCard = ({
    title,
    value,
    icon,
    color = "blue",
    subtitle,
    trend
  }: {
    title: string
    value: string | number
    icon: React.ReactNode
    color?: string
    subtitle?: string
    trend?: { value: number; isPositive: boolean }
  }) => (
    <Card.Root bg="bg.panel">
      <Card.Body>
        <VStack gap={3} align="stretch">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="text.muted" fontWeight="medium">
              {title}
            </Text>
            <Box color={`${color}.500`}>{icon}</Box>
          </HStack>
          <VStack gap={1} align="start">
            <Text fontSize="2xl" fontWeight="bold" color="text.primary">
              {value}
            </Text>
            {subtitle && (
              <Text fontSize="sm" color="text.muted">
                {subtitle}
              </Text>
            )}
            {trend && (
              <HStack gap={1}>
                <Text
                  fontSize="sm"
                  color={trend.isPositive ? "green.500" : "red.500"}
                  fontWeight="medium"
                >
                  {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
                </Text>
                <Text fontSize="sm" color="text.muted">
                  vs last period
                </Text>
              </HStack>
            )}
          </VStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  )

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">Dashboard Statistics</Heading>

      {/* Key Metrics */}
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4}>
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings}
          icon={<FiUsers />}
          color="blue"
          subtitle="All time"
        />
        <StatCard
          title="Revenue"
          value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<FiDollarSign />}
          color="green"
          subtitle={`Net: $${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Gross: $${stats.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          title="Total Passengers"
          value={stats.totalPassengers}
          icon={<FiUsers />}
          color="purple"
          subtitle="All time"
        />
        <StatCard
          title="Average Booking Value"
          value={`$${averageBookingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<FiTrendingUp />}
          color="orange"
          subtitle="Per booking"
        />
      </Grid>

      {/* Booking Status Breakdown */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={4} align="stretch">
            <Heading size="md">Booking Status Breakdown</Heading>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap={4}>
              <StatCard
                title="Confirmed"
                value={stats.confirmedBookings}
                icon={<FiCalendar />}
                color="blue"
                subtitle={`${((stats.confirmedBookings / stats.totalBookings) * 100).toFixed(1)}% of total`}
              />
              <StatCard
                title="Checked In"
                value={stats.checkedInBookings}
                icon={<FiUsers />}
                color="green"
                subtitle={`${((stats.checkedInBookings / stats.totalBookings) * 100).toFixed(1)}% of total`}
              />
              <StatCard
                title="Completed"
                value={stats.completedBookings}
                icon={<FiTrendingUp />}
                color="purple"
                subtitle={`${((stats.completedBookings / stats.totalBookings) * 100).toFixed(1)}% of total`}
              />
              <StatCard
                title="Cancelled"
                value={stats.cancelledBookings}
                icon={<FiCalendar />}
                color="red"
                subtitle={`${((stats.cancelledBookings / stats.totalBookings) * 100).toFixed(1)}% of total`}
              />
              <StatCard
                title="Refunded"
                value={stats.refundedBookings}
                icon={<FiDollarSign />}
                color="orange"
                subtitle={`${((stats.refundedBookings / stats.totalBookings) * 100).toFixed(1)}% of total`}
              />
            </Grid>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Capacity and Performance */}
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
        <Card.Root bg="bg.panel">
          <Card.Body>
            <VStack gap={4} align="stretch">
              <Heading size="md">Capacity Utilization</Heading>
              <VStack gap={3} align="stretch">
                <HStack justify="space-between">
                  <Text>Passengers Booked</Text>
                  <Text fontWeight="bold">{stats.totalPassengers}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Total Capacity</Text>
                  <Text fontWeight="bold">{totalCapacity}</Text>
                </HStack>
                <Box>
                  <HStack justify="space-between" mb={2}>
                    <Text fontSize="sm" color="text.muted">Utilization</Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {capacityUtilization.toFixed(1)}%
                    </Text>
                  </HStack>
                  <Box bg="gray.200" h="8px" borderRadius="md" overflow="hidden">
                    <Box
                      bg={capacityUtilization > 80 ? "red.500" : capacityUtilization > 60 ? "orange.500" : "green.500"}
                      h="100%"
                      w={`${Math.min(capacityUtilization, 100)}%`}
                      transition="width 0.3s ease"
                    />
                  </Box>
                </Box>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root bg="bg.panel">
          <Card.Body>
            <VStack gap={4} align="stretch">
              <Heading size="md">Performance Metrics</Heading>
              <VStack gap={3} align="stretch">
                <HStack justify="space-between">
                  <Text>Conversion Rate</Text>
                  <Badge colorPalette={conversionRate > 70 ? "green" : conversionRate > 50 ? "orange" : "red"}>
                    {conversionRate.toFixed(1)}%
                  </Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text>Recent Bookings (7 days)</Text>
                  <Text fontWeight="bold">{recentBookings.length}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Recent Revenue (7 days)</Text>
                  <Text fontWeight="bold">
                    ${recentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </HStack>
              </VStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      {/* Recent Activity */}
      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={4} align="stretch">
            <Heading size="md">Recent Activity (Last 7 Days)</Heading>
            <VStack gap={2} align="stretch">
              {recentBookings.length === 0 ? (
                <Text color="text.muted" textAlign="center" py={4}>
                  No recent bookings
                </Text>
              ) : (
                recentBookings.slice(0, 5).map((booking) => (
                  <HStack key={booking.id} justify="space-between" borderRadius="md">
                    <VStack align="start" gap={1}>
                      <Text fontWeight="medium">{booking.user_name}</Text>
                      <Text fontSize="sm" color="text.muted">
                        {booking.confirmation_code}
                      </Text>
                    </VStack>
                    <VStack align="end" gap={1}>
                      <Badge colorPalette={getStatusColor(booking.status || "unknown")}>
                        {(booking.status || "unknown").replace("_", " ").toUpperCase()}
                      </Badge>
                      <Text fontSize="sm" fontWeight="bold">
                        ${formatCents(booking.total_amount)}
                      </Text>
                    </VStack>
                  </HStack>
                ))
              )}
            </VStack>
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  )
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

export default DashboardStats
