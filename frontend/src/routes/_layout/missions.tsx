import {
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  Flex,
  Heading,
  Icon,
  Link,
  Table,
  Text,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiFileText, FiPlus } from "react-icons/fi"
import { z } from "zod"

import {
  LaunchesService,
  type MissionWithStats,
  MissionsService,
} from "@/client"
import MissionActionsMenu from "@/components/Common/MissionActionsMenu"
import YamlImportForm from "@/components/Common/YamlImportForm"
import AddMission from "@/components/Missions/AddMission"
import PendingMissions from "@/components/Pending/PendingMissions"
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
import { YamlImportService } from "@/services/yamlImportService"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import { formatCents } from "@/utils"

// Define sortable columns (must match MissionWithStats keys)
type SortableColumn =
  | "name"
  | "launch_id"
  | "trip_count"
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
  if (!sortBy || !sortDirection) {
    return [...missions].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      return 0
    })
  }

  return [...missions].sort((a, b) => {
    // Archived items always sort to the bottom
    if (a.archived !== b.archived) return a.archived ? 1 : -1

    let aValue: unknown = a[sortBy]
    let bValue: unknown = b[sortBy]

    // Coerce optional numeric stats to 0 for sorting
    if (
      sortBy === "trip_count" ||
      sortBy === "total_bookings" ||
      sortBy === "total_sales"
    ) {
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

// Function to create a map of launch IDs to launch objects (include archived so archived missions show launch name)
function useLaunchesMap() {
  const { data } = useQuery({
    queryKey: ["launches-map"],
    queryFn: () =>
      LaunchesService.readLaunches({ limit: 500, includeArchived: true }),
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
  const { includeArchived, setIncludeArchived } = useIncludeArchived()
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

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        page: 1,
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
    queryKey: [
      "missions",
      { page, pageSize: effectivePageSize, sortBy, sortDirection, includeArchived },

    ],
    queryFn: () =>
      MissionsService.readMissions({
        skip: ((page ?? 1) - 1) * effectivePageSize,
        limit: effectivePageSize,
        includeArchived,
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

  return (
    <Container maxW="full" px={{ base: 4, md: 6 }}>
      <Flex
        justify="space-between"
        align="center"
        pt={12}
        pb={4}
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="lg">Missions</Heading>
        <Flex gap={3} flexWrap="wrap">
          <Button variant="outline" onClick={() => setIsYamlImportOpen(true)}>
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

      {!isLoading && !isError && (
        <Flex align="center" gap={3} mb={4} flexWrap="wrap">
          <Checkbox.Root
            checked={includeArchived}
            onCheckedChange={(e) =>
              handleIncludeArchivedChange(e.checked === true)
            }
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="sm" color="text.secondary">
              Include archived
            </Checkbox.Label>
          </Checkbox.Root>
        </Flex>
      )}
      {isLoading ? (
        <PendingMissions />
      ) : isError ? (
        <Text>Error loading missions</Text>
      ) : (
        <Box overflowX="auto">
          <Table.Root size="md">
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
                  textAlign="center"
                >
                  <Flex align="center" justify="center">
                    Trips
                    <SortIcon column="trip_count" />
                  </Flex>
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  w="30"
                  fontWeight="bold"
                  cursor="pointer"
                  onClick={() => handleSort("total_bookings")}
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
                <Table.Row
                  key={mission.id}
                  opacity={mission.archived ? 0.6 : 1}
                  bg={mission.archived ? "bg.muted" : undefined}
                >
                  <Table.Cell>
                    <Link
                      asChild
                      color="dark.accent.primary"
                      _hover={{ textDecoration: "underline" }}
                    >
                      <RouterLink to="/bookings" search={{ missionId: mission.id }}>
                      <Text fontSize="md" fontWeight="500" as="span">
                        {mission.name || "—"}
                        </Text>
                      </RouterLink>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    {launchesMap.get(mission.launch_id)?.name ||
                      mission.launch_id}
                  </Table.Cell>
                  <Table.Cell textAlign="center" w="12">
                    {mission.trip_count ?? 0}
                  </Table.Cell>
                  <Table.Cell textAlign="center" w="12">
                    <Text fontWeight="medium">
                      {mission.total_bookings || 0}
                    </Text>
                  </Table.Cell>
                  <Table.Cell textAlign="center" w="16">
                    <Text fontWeight="medium">
                      ${formatCents(mission.total_sales ?? 0)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell textAlign="center" w="14">
                    <Badge
                      colorPalette={
                        mission.archived
                          ? "gray"
                          : mission.active
                            ? "green"
                            : "red"
                      }
                    >
                      {mission.archived
                        ? "Archived"
                        : mission.active
                          ? "Active"
                          : "Inactive"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell textAlign="center" w="14">
                    <Flex justify="center">
                      <MissionActionsMenu
                        mission={{
                          ...mission,
                          active: mission.active ?? false,
                          archived: mission.archived ?? false,
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
