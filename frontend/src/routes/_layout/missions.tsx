import { useState } from "react"
import {
  Button,
  Container,
  Flex,
  Heading,
  Table,
  Text,
  Badge,
  Icon,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiPlus, FiArrowUp, FiArrowDown } from "react-icons/fi"
import { z } from "zod"

import { LaunchesService, MissionsService, type MissionPublic } from "@/client"
import AddMission from "@/components/Missions/AddMission"
import MissionActionsMenu from "@/components/Common/MissionActionsMenu"
import PendingMissions from "@/components/Pending/PendingMissions"

// Define sortable columns
type SortableColumn = "name" | "launch_id" | "sales_open_at" | "active" | "public";
type SortDirection = "asc" | "desc";

const missionsSearchSchema = z.object({
  sortBy: z.enum(["name", "launch_id", "sales_open_at", "active", "public"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

// Helper function to sort missions
const sortMissions = (missions: MissionPublic[], sortBy: SortableColumn | undefined, sortDirection: SortDirection | undefined) => {
  if (!sortBy || !sortDirection) return missions;

  return [...missions].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];

    // Special handling for dates
    if (sortBy === "sales_open_at") {
      aValue = a.sales_open_at ? new Date(a.sales_open_at).getTime() : 0;
      bValue = b.sales_open_at ? new Date(b.sales_open_at).getTime() : 0;
    }

    // Handle booleans
    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      return sortDirection === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle numeric sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc"
        ? aValue - bValue
        : bValue - aValue;
    }

    return 0;
  });
};

// Function to create a map of launch IDs to launch objects
function useLaunchesMap() {
  const { data } = useQuery({
    queryKey: ["launches-map"],
    queryFn: () => LaunchesService.readLaunches({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const launchesMap = new Map()
  if (data?.data) {
    data.data.forEach(launch => {
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
  const launchesMap = useLaunchesMap()
  const { sortBy, sortDirection } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const handleSort = (column: SortableColumn) => {
    const newDirection: SortDirection =
      sortBy === column && sortDirection === "asc" ? "desc" : "asc";

    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        sortBy: column,
        sortDirection: newDirection,
      }),
    });
  };

  // Fetch missions
  const {
    data: missionsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["missions", { sortBy, sortDirection }],
    queryFn: () => MissionsService.readMissions(),
  })

  // Sort the missions
  const missions = sortMissions(
    missionsResponse?.data || [],
    sortBy,
    sortDirection
  );

  const handleAddMissionSuccess = () => {
    // Additional logic after successful mission addition
  }

  const SortIcon = ({ column }: { column: SortableColumn }) => {
    if (sortBy !== column) return null;
    return (
      <Icon
        as={sortDirection === "asc" ? FiArrowUp : FiArrowDown}
        ml={2}
        boxSize={4}
      />
    );
  };

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Missions</Heading>
        <Button onClick={() => setIsAddMissionOpen(true)}>
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Mission</span>
          </Flex>
        </Button>
      </Flex>

      {isLoading ? (
        <PendingMissions />
      ) : isError ? (
        <Text>Error loading missions</Text>
      ) : (
        <Table.Root size={{ base: "sm", md: "md" }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader
                w="sm"
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
                w="sm"
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
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("sales_open_at")}
              >
                <Flex align="center">
                  Sales Open
                  <SortIcon column="sales_open_at" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                <Flex>Status</Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {missions.map((mission) => (
                <Table.Row key={mission.id}>
                  <Table.Cell>{mission.name}</Table.Cell>
                  <Table.Cell>
                    {launchesMap.get(mission.launch_id)?.name || mission.launch_id}
                  </Table.Cell>
                  <Table.Cell>
                    {mission.sales_open_at
                      ? new Date(mission.sales_open_at).toLocaleString()
                      : "Not set"}
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={2}>
                      <Badge colorScheme={mission.active ? "green" : "red"}>
                        {mission.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge colorScheme={mission.public ? "blue" : "gray"}>
                        {mission.public ? "Public" : "Private"}
                      </Badge>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <MissionActionsMenu
                      mission={{
                        ...mission,
                        active: mission.active ?? false,
                        public: mission.public ?? false,
                        sales_open_at: mission.sales_open_at ?? null,
                        refund_cutoff_hours: mission.refund_cutoff_hours ?? 0
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}

      <AddMission
        isOpen={isAddMissionOpen}
        onClose={() => setIsAddMissionOpen(false)}
        onSuccess={handleAddMissionSuccess}
      />
    </Container>
  )
}
