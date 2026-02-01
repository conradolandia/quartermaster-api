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
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiFileText, FiPlus } from "react-icons/fi"
import { z } from "zod"

import { LaunchesService, type MissionWithStats, MissionsService } from "@/client"
import { formatCents } from "@/utils"
import {
  DEFAULT_PAGE_SIZE,
  PageSizeSelect,
} from "@/components/ui/page-size-select"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import {
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"
import MissionActionsMenu from "@/components/Common/MissionActionsMenu"
import YamlImportForm from "@/components/Common/YamlImportForm"
import AddMission from "@/components/Missions/AddMission"
import { YamlImportService } from "@/services/yamlImportService"
import PendingMissions from "@/components/Pending/PendingMissions"

// Define sortable columns (must match MissionWithStats keys)
type SortableColumn =
  | "name"
  | "launch_id"
  | "trip_count"
  | "sales_open_at"
  | "active"
  | "total_bookings"
  | "total_sales"
type SortDirection = "asc" | "desc"

const missionsSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  sortBy: z
    .enum([
      "name",
      "launch_id",
      "trip_count",
      "sales_open_at",
      "active",
      "total_bookings",
      "total_sales",
    ])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

// Helper function to sort missions
const sortMissions = (
  missions: MissionWithStats[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return missions

  return [...missions].sort((a, b) => {
    let aValue: unknown = a[sortBy]
    let bValue: unknown = b[sortBy]

    // Special handling for dates (parse as UTC for correct ordering)
    if (sortBy === "sales_open_at") {
      aValue = a.sales_open_at ? parseApiDate(a.sales_open_at).getTime() : 0
      bValue = b.sales_open_at ? parseApiDate(b.sales_open_at).getTime() : 0
    }

    // Coerce optional numeric stats to 0 for sorting
    if (sortBy === "trip_count" || sortBy === "total_bookings" || sortBy === "total_sales") {
      aValue = typeof aValue === "number" ? aValue : 0
      bValue = typeof bValue === "number" ? bValue : 0
    }

    // Handle booleans
    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      return sortDirection === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue)
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    // Handle numeric sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })
}

// Function to create a map of launch IDs to launch objects
function useLaunchesMap() {
  const { data } = useQuery({
    queryKey: ["launches-map"],
    queryFn: () => LaunchesService.readLaunches({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const launchesMap = new Map()
  if (data?.data) {
    data.data.forEach((launch) => {
      launchesMap.set(launch.id, launch)
    })
  }

  return launchesMap
}

export const Route = createFileRoute("/_layout/missions")({
  component: Missions,
  validateSearch: (search) => missionsSearchSchema.parse(search),
})

function Missions() {
  const [isAddMissionOpen, setIsAddMissionOpen] = useState(false)
  const [isYamlImportOpen, setIsYamlImportOpen] = useState(false)
  const launchesMap = useLaunchesMap()
  const { page, pageSize, sortBy, sortDirection } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE

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

  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({
        ...prev,
        page: newPage,
      }),
    })

  const setPageSize = (newPageSize: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({
        ...prev,
        pageSize: newPageSize,
        page: 1,
      }),
    })

  // Fetch missions
  const {
    data: missionsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["missions", { page, pageSize: effectivePageSize, sortBy, sortDirection }],
    queryFn: () =>
      MissionsService.readMissions({
        skip: ((page ?? 1) - 1) * effectivePageSize,
        limit: effectivePageSize,
      }),
  })

  const allMissions = missionsResponse?.data ?? []
  const count = missionsResponse?.count ?? allMissions.length

  // Sort the missions (client-side; API may not support sort)
  const missions = sortMissions(allMissions, sortBy, sortDirection)

  const handleAddMissionSuccess = () => {
    // Additional logic after successful mission addition
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

  const renderSalesOpenAt = (dateString: string | null | undefined, timezone?: string | null) => {
    if (!dateString) return "Not set"
    const d = parseApiDate(dateString)
    const parts = timezone ? formatInLocationTimezoneWithAbbr(d, timezone) : null
    if (parts) {
      return (
        <>
          {parts.dateTime}
          <Text as="span" display="block" fontSize="xs" opacity={0.7}>
            {parts.timezoneAbbr}
          </Text>
        </>
      )
    }
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Missions</Heading>
        <Flex gap={3}>
          <Button
            variant="outline"
            onClick={() => setIsYamlImportOpen(true)}
          >
            <Flex align="center" gap={2}>
              <FiFileText />
              <span>Import from YAML</span>
            </Flex>
          </Button>
          <Button onClick={() => setIsAddMissionOpen(true)}>
            <Flex align="center" gap={2}>
              <FiPlus />
              <span>Add Mission</span>
            </Flex>
          </Button>
        </Flex>
      </Flex>

      {isLoading ? (
        <PendingMissions />
      ) : isError ? (
        <Text>Error loading missions</Text>
      ) : (
        <Box overflowX="auto">
          <Table.Root size={{ base: "sm", md: "md" }}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader
                  minW="160px"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("name")}
                >
                  <Flex align="center">
                    Name
                    <SortIcon column="name" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  minW="140px"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("launch_id")}
                  display={{ base: "none", md: "table-cell" }}
                >
                  <Flex align="center">
                    Launch
                    <SortIcon column="launch_id" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="30"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("trip_count")}
                  display={{ base: "none", md: "table-cell" }}
                  textAlign="center"
                >
                  <Flex align="center" justify="center">
                    Trips
                    <SortIcon column="trip_count" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="sm"
                  minW="140px"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("sales_open_at")}
                  display={{ base: "none", lg: "table-cell" }}
                >
                  <Flex align="center">
                    Sales Open
                    <SortIcon column="sales_open_at" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="30"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("total_bookings")}
                  display={{ base: "none", lg: "table-cell" }}
                  textAlign="center"
                >
                  <Flex align="center" justify="center">
                    Bookings
                    <SortIcon column="total_bookings" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="40"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("total_sales")}
                  display={{ base: "none", lg: "table-cell" }}
                  textAlign="center"
                >
                  <Flex align="center" justify="center">
                    Sales
                    <SortIcon column="total_sales" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="40"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("active")}
                >
                  <Flex align="center">
                    Status
                    <SortIcon column="active" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader w="14" fontWeight="bold" textAlign="center">
                  Actions
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
          <Table.Body>
            {missions.map((mission) => (
              <Table.Row key={mission.id}>
                <Table.Cell>{mission.name}</Table.Cell>
                <Table.Cell display={{ base: "none", md: "table-cell" }}>
                  {launchesMap.get(mission.launch_id)?.name ||
                    mission.launch_id}
                </Table.Cell>
                <Table.Cell
                  display={{ base: "none", md: "table-cell" }}
                  textAlign="center"
                  w="12"
                >
                  {mission.trip_count ?? 0}
                </Table.Cell>
                <Table.Cell
                  display={{ base: "none", lg: "table-cell" }}
                  minW="140px"
                >
                  {renderSalesOpenAt(mission.sales_open_at, mission.timezone)}
                </Table.Cell>
                <Table.Cell
                  display={{ base: "none", lg: "table-cell" }}
                  textAlign="center"
                  w="12"
                >
                  <Text fontWeight="medium">{mission.total_bookings || 0}</Text>
                </Table.Cell>
                <Table.Cell
                  display={{ base: "none", lg: "table-cell" }}
                  textAlign="center"
                  w="16"
                >
                  <Text fontWeight="medium">
                    ${formatCents(mission.total_sales ?? 0)}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="center" w="14">
                  <Flex gap={2}>
                    <Badge colorPalette={mission.active ? "green" : "red"}>
                      {mission.active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge
                      colorPalette={
                        mission.booking_mode === "public"
                          ? "blue"
                          : mission.booking_mode === "early_bird"
                            ? "purple"
                            : "gray"
                      }
                    >
                      {mission.booking_mode === "public"
                        ? "Public"
                        : mission.booking_mode === "early_bird"
                          ? "Early Bird"
                          : "Private"}
                    </Badge>
                  </Flex>
                </Table.Cell>
                <Table.Cell textAlign="center" w="14">
                  <Flex justify="center">
                    <MissionActionsMenu
                    mission={{
                      ...mission,
                      active: mission.active ?? false,
                      booking_mode: mission.booking_mode ?? "private",
                      sales_open_at: mission.sales_open_at ?? null,
                      refund_cutoff_hours: mission.refund_cutoff_hours ?? 0,
                    }}
                  />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          </Table.Root>
        </Box>
      )}

      {!isLoading && !isError && count > 0 && (
        <Flex
          justifyContent="space-between"
          align="center"
          flexWrap="wrap"
          gap={4}
          mt={4}
        >
          <PageSizeSelect value={effectivePageSize} onChange={setPageSize} />
          {count > effectivePageSize && (
            <PaginationRoot
              page={page}
              count={count}
              pageSize={effectivePageSize}
              onPageChange={({ page }) => setPage(page)}
            >
              <Flex>
                <PaginationPrevTrigger />
                <PaginationItems />
                <PaginationNextTrigger />
              </Flex>
            </PaginationRoot>
          )}
        </Flex>
      )}

      <AddMission
        isOpen={isAddMissionOpen}
        onClose={() => setIsAddMissionOpen(false)}
        onSuccess={handleAddMissionSuccess}
      />

      {/* YAML Import Modal */}
      {isYamlImportOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={1000}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={4}
        >
          <Box
            border="1px solid"
            borderColor="dark.border.default"
            borderRadius="lg"
            maxW="md"
            w="full"
            maxH="90vh"
            overflowY="auto"
          >
            <YamlImportForm
              onImport={YamlImportService.importMission}
              onSuccess={() => {
                setIsYamlImportOpen(false)
                // Refresh the missions list
                window.location.reload()
              }}
              onCancel={() => setIsYamlImportOpen(false)}
              placeholder="Select a mission YAML file to import"
            />
          </Box>
        </Box>
      )}
    </Container>
  )
}
