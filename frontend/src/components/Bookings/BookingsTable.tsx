import {
  Badge,
  Box,
  Button,
  createListCollection,
  Flex,
  Select,
  Table,
  Text,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiX } from "react-icons/fi"

import { BookingsService, MissionsService } from "@/client"
import BookingActionsMenu from "@/components/Common/BookingActionsMenu"
import useCustomToast from "@/hooks/useCustomToast"
import PendingBookings from "@/components/Pending/PendingBookings"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import SortIcon from "./shared/SortIcon"
import { getStatusColor, type SortableColumn, type SortDirection } from "./types"

const PER_PAGE = 10

interface BookingsTableProps {
  onBookingClick: (confirmationCode: string) => void
}

export default function BookingsTable({ onBookingClick }: BookingsTableProps) {
  const { showSuccessToast } = useCustomToast()
  const [missionId, setMissionId] = useState<string | undefined>(undefined)
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search))

  const copyConfirmationCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(code).then(() => {
      showSuccessToast("Confirmation code copied to clipboard")
    })
  }

  // Parse search params
  const page = parseInt(searchParams.get("page") || "1")
  const sortBy = (searchParams.get("sortBy") as SortableColumn) || "created_at"
  const sortDirection = (searchParams.get("sortDirection") as SortDirection) || "desc"

  // Listen for URL changes
  useEffect(() => {
    const handlePopState = () => {
      setSearchParams(new URLSearchParams(window.location.search))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Fetch bookings with mission filter and sorting
  const {
    data: bookingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookings", page, missionId, sortBy, sortDirection],
    queryFn: () =>
      BookingsService.listBookings({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        missionId: missionId ? missionId : undefined,
        sortBy: sortBy,
        sortDirection: sortDirection,
      }),
  })

  // Fetch missions for filter dropdown
  const { data: missionsData } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions({ limit: 100 }),
  })

  // Fetch all bookings to determine which missions have bookings
  const { data: allBookingsData } = useQuery({
    queryKey: ["all-bookings-for-missions"],
    queryFn: () => BookingsService.listBookings({ limit: 1000 }),
  })

  const bookings = bookingsData?.data || []
  const count = bookingsData?.total || 0
  const missions = missionsData?.data || []

  // Filter missions to only show those with existing bookings
  const missionsWithBookings = missions.filter((mission: any) =>
    allBookingsData?.data?.some((booking: any) => booking.mission_id === mission.id)
  )

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc"

    const params = new URLSearchParams(window.location.search)
    params.set("sortBy", column)
    params.set("sortDirection", newDirection)
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`)

    // Update local state to trigger re-render
    setSearchParams(new URLSearchParams(params.toString()))
  }


  const handleMissionFilter = (selectedMissionId?: string) => {
    setMissionId(selectedMissionId)
    const params = new URLSearchParams(window.location.search)
    if (selectedMissionId) {
      params.set("missionId", selectedMissionId)
    } else {
      params.delete("missionId")
    }
    params.set("page", "1")
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`)

    // Update local state to trigger re-render
    setSearchParams(new URLSearchParams(params.toString()))
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set("page", newPage.toString())
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`)

    // Update local state to trigger re-render
    setSearchParams(new URLSearchParams(params.toString()))
  }

  if (isLoading) {
    return <PendingBookings />
  }

  if (error) {
    return <Text>Error loading bookings</Text>
  }

  // Create mission collection for the dropdown
  const missionsCollection = createListCollection({
    items: [
      { label: "All Missions", value: "" },
      ...missionsWithBookings.map((mission: any) => ({
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
          <Select.Control width="100%">
            <Select.Trigger>
              <Select.ValueText placeholder="All Missions" />
            </Select.Trigger>
          </Select.Control>
          <Select.Positioner>
            <Select.Content minWidth="300px">
              {missionsCollection.items.map((item) => (
                <Select.Item key={item.value} item={item}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
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
                  Confirmation Code
                  <SortIcon column="confirmation_code" sortBy={sortBy} sortDirection={sortDirection} />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("user_name")}
              >
                <Flex align="center">
                  Name
                  <SortIcon column="user_name" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="user_email" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="user_phone" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="mission_name" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="status" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="total_amount" sortBy={sortBy} sortDirection={sortDirection} />
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
                  <SortIcon column="created_at" sortBy={sortBy} sortDirection={sortDirection} />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {bookings.map((booking) => (
              <Table.Row key={booking.id}>
                <Table.Cell
                  cursor="pointer"
                  onClick={(e) => copyConfirmationCode(e, booking.confirmation_code)}
                  title="Click to copy"
                >
                  <Text fontFamily="mono" fontWeight="bold" color="accent.default">
                    {booking.confirmation_code}
                  </Text>
                </Table.Cell>
                <Table.Cell
                  cursor="pointer"
                  onClick={() => onBookingClick(booking.confirmation_code)}
                >
                  {booking.user_name}
                </Table.Cell>
                <Table.Cell
                  cursor="pointer"
                  onClick={() => onBookingClick(booking.confirmation_code)}
                  display={{ base: "none", md: "table-cell" }}
                >
                  {booking.user_email}
                </Table.Cell>
                <Table.Cell
                  cursor="pointer"
                  onClick={() => onBookingClick(booking.confirmation_code)}
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.user_phone}
                </Table.Cell>
                <Table.Cell
                  cursor="pointer"
                  onClick={() => onBookingClick(booking.confirmation_code)}
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {booking.mission_name || "N/A"}
                </Table.Cell>
                <Table.Cell>
                  <Badge colorScheme={getStatusColor(booking.status || "")}>
                    {booking.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text fontWeight="bold">
                    ${booking.total_amount?.toFixed(2) || "0.00"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {new Date(booking.created_at).toLocaleDateString()}
                </Table.Cell>
                <Table.Cell>
                  <BookingActionsMenu booking={booking} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {count > PER_PAGE && (
        <Flex justifyContent="flex-end" mt={4}>
          <PaginationRoot
            count={count}
            pageSize={PER_PAGE}
            onPageChange={({ page }) => handlePageChange(page)}
          >
            <Flex>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </Flex>
          </PaginationRoot>
        </Flex>
      )}
    </>
  )
}
