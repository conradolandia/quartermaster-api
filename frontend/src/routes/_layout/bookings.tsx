import {
  Badge,
  Box,
  Button,
  Container,
  createListCollection,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Select,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiPlus, FiSearch, FiX } from "react-icons/fi"
import { z } from "zod"

import { BookingsService, MissionsService } from "@/client"
import AddBooking from "@/components/Bookings/AddBooking"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import PendingBookings from "@/components/Pending/PendingBookings"
import BookingConfirmation from "@/components/Public/BookingConfirmation"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"

// Define sortable columns
type SortableColumn =
  | "confirmation_code"
  | "user_name"
  | "user_email"
  | "user_phone"
  | "status"
  | "total_amount"
  | "created_at"
  | "mission_name"
type SortDirection = "asc" | "desc"

const bookingsSearchSchema = z.object({
  page: z.number().catch(1),
  code: z.string().optional(),
  missionId: z.string().optional(),
  sortBy: z
    .enum([
      "confirmation_code",
      "user_name",
      "user_email",
      "user_phone",
      "status",
      "total_amount",
      "created_at",
      "mission_name",
    ])
    .catch("created_at"),
  sortDirection: z.enum(["asc", "desc"]).catch("desc"),
})

const PER_PAGE = 10

// Helper function to sort bookings
const sortBookings = (
  bookings: any[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return bookings

  return [...bookings].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    // Handle date sorting
    if (sortBy === "created_at") {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }

    // Handle numeric sorting (total_amount)
    if (sortBy === "total_amount") {
      aValue = Number(aValue) || 0
      bValue = Number(bValue) || 0
    }

    // Handle null/undefined values for mission_name
    if (sortBy === "mission_name") {
      aValue = aValue || ""
      bValue = bValue || ""
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    // Handle numeric/date sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "green"
    case "pending_payment":
      return "yellow"
    case "cancelled":
      return "red"
    case "refunded":
      return "gray"
    case "completed":
      return "blue"
    case "checked_in":
      return "teal"
    default:
      return "gray"
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
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

const itemTypes = [
  { value: "adult_ticket", label: "Adult Ticket" },
  { value: "child_ticket", label: "Child Ticket" },
  { value: "infant_ticket", label: "Infant Ticket" },
  { value: "swag", label: "Merchandise" },
]

const getItemTypeLabel = (itemType: string) => {
  return itemTypes.find((type) => type.value === itemType)?.label || itemType
}

export const Route = createFileRoute("/_layout/bookings")({
  component: Bookings,
  validateSearch: (search) => bookingsSearchSchema.parse(search),
})

function BookingDetails({ confirmationCode }: { confirmationCode: string }) {
  const navigate = useNavigate({ from: Route.fullPath })

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
  })

  if (isLoading) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Text>Loading booking details...</Text>
        </VStack>
      </Container>
    )
  }

  if (error || !booking) {
    return (
      <Container maxW="full">
        <VStack align="center" justify="center" minH="200px">
          <Icon as={FiX} boxSize={8} color="red.500" />
          <Text fontSize="lg" fontWeight="bold">
            Booking Not Found
          </Text>
          <Text color="gray.600">
            No booking found with confirmation code: {confirmationCode}
          </Text>
          <Button onClick={() => navigate({ search: {} })}>
            Back to Bookings
          </Button>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="full" mt={12}>
      <Flex alignItems="baseline" mb={6} gap={4} justifyContent="space-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ search: {} })}
        >
          Back to Bookings
        </Button>
        <Heading size="2xl">
          Booking Details:{" "}
          <Text as="span" fontFamily="mono" color="dark.text.highlight">
            {booking.confirmation_code}
          </Text>
        </Heading>
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
              <Flex gap={6} justify="space-between">
                <Box flex="1">
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Status:</Text>
                    <Badge colorScheme={getStatusColor(booking.status || "")}>
                      {booking.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                    </Badge>
                  </Flex>
                  <Flex gap={4} mb={2} alignItems="baseline">
                    <Text fontWeight="bold">Confirmation Code:</Text>
                    <Text
                      fontFamily="mono"
                      color="dark.text.highlight"
                      fontWeight="bold"
                    >
                      {booking.confirmation_code}
                    </Text>
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
              {booking.billing_address && (
                <Flex gap={4} mb={2} alignItems="baseline">
                  <Text fontWeight="bold" mb={2}>
                    Billing Address:
                  </Text>
                  <Text fontSize="sm" whiteSpace="pre-line">
                    {booking.billing_address}
                  </Text>
                </Flex>
              )}
            </Box>
          </Box>
        </Flex>

        <Flex gap={6} direction={{ base: "column", lg: "row" }}>
          <Box flex="1">
            <Heading size="md" mb={4}>
              Payment Summary
            </Heading>
            <Box
              bg="dark.bg.secondary"
              p={4}
              borderRadius="md"
              border="1px"
              borderColor="dark.border.secondary"
              color="dark.text.primary"
            >
              <Flex justify="space-between" mb={2}>
                <Text>Subtotal:</Text>
                <Text>{formatCurrency(booking.subtotal)}</Text>
              </Flex>
              {booking.discount_amount > 0 && (
                <Flex justify="space-between" mb={2}>
                  <Text>Discount:</Text>
                  <Text color="green.500">
                    -{formatCurrency(booking.discount_amount)}
                  </Text>
                </Flex>
              )}
              <Flex justify="space-between" mb={2}>
                <Text>Tax:</Text>
                <Text>{formatCurrency(booking.tax_amount)}</Text>
              </Flex>
              {booking.tip_amount > 0 && (
                <Flex justify="space-between" mb={2}>
                  <Text>Tip:</Text>
                  <Text>{formatCurrency(booking.tip_amount)}</Text>
                </Flex>
              )}
              <Flex
                justify="space-between"
                fontWeight="bold"
                fontSize="lg"
                pt={2}
                borderTop="1px"
                borderColor="dark.border.secondary"
              >
                <Text>Total:</Text>
                <Text>{formatCurrency(booking.total_amount)}</Text>
              </Flex>
              {booking.payment_intent_id && (
                <Flex
                  justify="space-between"
                  mt={4}
                  pt={2}
                  borderTop="1px"
                  borderColor="dark.border.secondary"
                >
                  <Text fontWeight="bold">Payment ID:</Text>
                  <Text fontFamily="mono" fontSize="sm">
                    {booking.payment_intent_id}
                  </Text>
                </Flex>
              )}
            </Box>
          </Box>

          <Box flex="1">
            <Heading size="md" mb={4}>
              Additional Information
            </Heading>
            <Box
              bg="dark.bg.secondary"
              p={4}
              borderRadius="md"
              border="1px"
              borderColor="dark.border.secondary"
              color="dark.text.primary"
            >
              {booking.special_requests && (
                <Box mb={4}>
                  <Text fontWeight="bold" mb={2}>
                    Special Requests:
                  </Text>
                  <Text fontSize="sm" whiteSpace="pre-line">
                    {booking.special_requests}
                  </Text>
                </Box>
              )}
              <Flex gap={4} mb={4} alignItems="baseline">
                <Text fontWeight="bold">Launch Updates:</Text>
                <Badge
                  colorScheme={booking.launch_updates_pref ? "green" : "gray"}
                >
                  {booking.launch_updates_pref ? "Enabled" : "Disabled"}
                </Badge>
              </Flex>
              {booking.items && booking.items.length > 0 && (
                <Box>
                  <Text fontWeight="bold" mb={3}>
                    Booking Items ({booking.items.length}):
                  </Text>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Type</Table.ColumnHeader>
                        <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                        <Table.ColumnHeader>Price</Table.ColumnHeader>
                        <Table.ColumnHeader>Status</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {booking.items.map((item, index) => (
                        <Table.Row key={index}>
                          <Table.Cell fontWeight="medium">
                            {getItemTypeLabel(item.item_type)}
                          </Table.Cell>
                          <Table.Cell>{item.quantity}</Table.Cell>
                          <Table.Cell fontWeight="medium">
                            {formatCurrency(item.price_per_unit)}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              size="sm"
                              colorScheme={getStatusColor(item.status || "")}
                            >
                              {item.status || "UNKNOWN"}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Box>
          </Box>
        </Flex>
      </VStack>
    </Container>
  )
}

function BookingsTable() {
  const { page, sortBy, sortDirection, missionId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"

    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        sortBy: column,
        sortDirection: newDirection,
      }),
    })
  }

  // Fetch all bookings to get unique mission IDs for filter
  const { data: allBookingsResponse } = useQuery({
    queryKey: ["bookings-all"],
    queryFn: () =>
      BookingsService.listBookings({
        skip: 0,
        limit: 1000, // Get all bookings
      }),
  })

  // Fetch missions for the filter dropdown
  const { data: missionsResponse } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions(),
  })

  // Filter missions to only show those with bookings
  const allBookings = allBookingsResponse?.data ?? []
  const allMissions = missionsResponse?.data ?? []
  const uniqueMissionIds = new Set(
    allBookings.map((booking) => booking.mission_id).filter(Boolean)
  )
  const missions = allMissions.filter((mission) =>
    uniqueMissionIds.has(mission.id)
  )

  const {
    data: response,
    isLoading,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["bookings", { page, missionId }],
    queryFn: () =>
      BookingsService.listBookings({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        missionId: missionId || undefined,
      }),
    placeholderData: (prevData) => prevData,
  })

  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page: newPage }),
    })

  // Extract data and total from paginated response
  const data = response?.data ?? []
  const totalCount = response?.total ?? 0

  // Sort bookings (data is already paginated by backend)
  const bookings = sortBookings(data, sortBy, sortDirection)

  if (isLoading) {
    return <PendingBookings />
  }

  if (bookings.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>No bookings found</EmptyState.Title>
            <EmptyState.Description>
              Add a new booking to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "green"
      case "pending_payment":
        return "yellow"
      case "cancelled":
        return "red"
      case "refunded":
        return "gray"
      case "completed":
        return "blue"
      case "checked_in":
        return "teal"
      default:
        return "gray"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const SortIcon = ({ column }: { column: SortableColumn }) => {
    if (sortBy !== column) return null
    return (
      <Icon
        as={sortDirection === "asc" ? FiArrowUp : FiArrowDown}
        ml={2}
        boxSize={4}
      />
    )
  }

  const handleMissionFilter = (missionId: string | undefined) => {
    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        missionId: missionId || undefined,
        page: 1, // Reset to first page when filtering
      }),
    })
  }

  // Create mission collection for the dropdown
  const missionsCollection = createListCollection({
    items: [
      { label: "All Missions", value: "" },
      ...missions.map((mission) => ({
        label: mission.name,
        value: mission.id,
      })),
    ],
  })

  return (
    <>
      <Flex mb={4} gap={3} align="center">
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Filter by Mission:
        </Text>
        <Select.Root
          collection={missionsCollection}
          size="xs"
          width="250px"
          borderColor="white"
          value={missionId ? [missionId] : [""]}
          onValueChange={(e) => handleMissionFilter(e.value[0] || undefined)}
        >
          <Select.Trigger>
            <Select.ValueText placeholder="All Missions" />
          </Select.Trigger>
          <Select.Content>
            {missionsCollection.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                {item.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        {missionId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleMissionFilter(undefined)}
          >
            <Flex align="center" gap={1}>
              <FiX />
              Clear filter
            </Flex>
          </Button>
        )}
      </Flex>

      <Box overflowX="auto">
        <Table.Root size={{ base: "sm", md: "md" }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("confirmation_code")}
              >
                <Flex align="center">
                  Confirmation code
                  <SortIcon column="confirmation_code" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_name")}
              >
                <Flex align="center">
                  Customer
                  <SortIcon column="user_name" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_email")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  Email
                  <SortIcon column="user_email" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_phone")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Phone
                  <SortIcon column="user_phone" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("mission_name")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Mission
                  <SortIcon column="mission_name" />
                </Flex>
              </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("status")}
            >
              <Flex align="center">
                Status
                <SortIcon column="status" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("total_amount")}
            >
              <Flex align="center">
                Total
                <SortIcon column="total_amount" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("created_at")}
            >
              <Flex align="center">
                Created
                <SortIcon column="created_at" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm" fontWeight="bold">
              Actions
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {bookings.map((booking) => (
            <Table.Row key={booking.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell fontWeight="medium">
                <Button
                  variant="ghost"
                  size="sm"
                  color="dark.accent.primary"
                  fontWeight="medium"
                  px={2}
                  py={1}
                  h="auto"
                  minH="unset"
                  _hover={{ color: "dark.accent.primary" }}
                  onClick={() =>
                    navigate({ search: { code: booking.confirmation_code } })
                  }
                >
                  {booking.confirmation_code}
                </Button>
              </Table.Cell>
              <Table.Cell truncate maxW="200px">{booking.user_name}</Table.Cell>
              <Table.Cell truncate maxW="200px" display={{ base: "none", md: "table-cell" }}>
                {booking.user_email}
              </Table.Cell>
              <Table.Cell display={{ base: "none", lg: "table-cell" }}>{booking.user_phone}</Table.Cell>
              <Table.Cell truncate maxW="200px" display={{ base: "none", lg: "table-cell" }}>
                {booking.mission_name || "N/A"}
              </Table.Cell>
              <Table.Cell>
                <Badge colorScheme={getStatusColor(booking.status || "")}>
                  {booking.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                </Badge>
              </Table.Cell>
              <Table.Cell fontWeight="bold">
                {formatCurrency(booking.total_amount)}
              </Table.Cell>
              <Table.Cell truncate maxW="200px" fontSize="xs">{formatDate(booking.created_at)}</Table.Cell>
              <Table.Cell>
                <BookingActionsMenu booking={booking} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        </Table.Root>
      </Box>

      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={totalCount}
          pageSize={PER_PAGE}
          onPageChange={({ page }) => setPage(page)}
        >
          <Flex>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}

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

      <BookingsTable />

      <AddBooking
        isOpen={isAddBookingOpen}
        onClose={() => setIsAddBookingOpen(false)}
        onSuccess={handleAddBookingSuccess}
      />
    </Container>
  )
}
