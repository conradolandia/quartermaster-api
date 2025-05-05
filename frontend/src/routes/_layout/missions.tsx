import { useState } from "react"
import {
  Button,
  Container,
  Flex,
  Heading,
  Table,
  Text,
  Badge,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FiPlus } from "react-icons/fi"

import { LaunchesService, MissionsService } from "@/client"
import AddMission from "@/components/Missions/AddMission"
import MissionActionsMenu from "@/components/Common/MissionActionsMenu"
import PendingMissions from "@/components/Pending/PendingMissions"

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
})

function Missions() {
  const [isAddMissionOpen, setIsAddMissionOpen] = useState(false)
  const launchesMap = useLaunchesMap()

  // Fetch missions
  const {
    data: missionsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions(),
  })

  const handleAddMissionSuccess = () => {
    // Additional logic after successful mission addition
  }

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
              <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
              <Table.ColumnHeader w="sm">Launch</Table.ColumnHeader>
              <Table.ColumnHeader w="sm">Sales Open</Table.ColumnHeader>
              <Table.ColumnHeader w="sm">Status</Table.ColumnHeader>
              <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {missionsResponse?.data?.map((mission) => (
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
