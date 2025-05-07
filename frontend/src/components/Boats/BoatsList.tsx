import React from "react"
import {
  EmptyState,
  Flex,
  Table,
  VStack,
  Text
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiSearch } from "react-icons/fi"

import { BoatsService, type BoatPublic, JurisdictionsService } from "@/client"
import BoatActionsMenu from "@/components/Common/BoatActionsMenu"
import PendingBoats from "@/components/Pending/PendingBoats"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import { Boat } from "@/types/boat"

interface BoatsListProps {
  page: number
  setPage: (page: number) => void
  jurisdictionId?: string
}

const PER_PAGE = 5

// Helper function to convert BoatPublic to Boat
const convertToBoat = (boatPublic: BoatPublic): Boat => ({
  ...boatPublic,
  map_link: boatPublic.map_link ?? null,
});

const BoatsList: React.FC<BoatsListProps> = ({ page, setPage, jurisdictionId }) => {
  // Create the appropriate query function based on whether we have a jurisdictionId
  const queryFn = jurisdictionId
    ? () => BoatsService.readBoatsByJurisdiction({
        jurisdictionId,
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE
      })
    : () => BoatsService.readBoats({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE
      })

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["boats", { page, jurisdictionId }],
    queryFn,
    placeholderData: (prevData) => prevData,
  })

  // Get all jurisdictions for display purposes
  const { data: jurisdictionsData } = useQuery({
    queryKey: ["jurisdictions-for-boats"],
    queryFn: () => JurisdictionsService.readJurisdictions({ limit: 100 }),
  })

  // Create a map of jurisdictions for easy lookup
  const jurisdictionsMap = new Map()
  if (jurisdictionsData?.data) {
    jurisdictionsData.data.forEach(jurisdiction => {
      jurisdictionsMap.set(jurisdiction.id, jurisdiction)
    })
  }

  // Convert BoatPublic to Boat
  const boats = (data?.data.slice(0, PER_PAGE) ?? []).map(convertToBoat)
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingBoats />
  }

  if (boats.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>You don't have any boats yet</EmptyState.Title>
            <EmptyState.Description>
              Add a new boat to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Capacity</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Provider</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Jurisdiction</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {boats.map((boat) => {
            const jurisdiction = jurisdictionsMap.get(boat.jurisdiction_id)

            return (
              <Table.Row key={boat.id} opacity={isPlaceholderData ? 0.5 : 1}>
                <Table.Cell truncate maxW="sm">
                  {boat.name}
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {boat.capacity}
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {boat.provider_name}
                </Table.Cell>
                <Table.Cell truncate maxW="sm">
                  {jurisdiction ? (
                    <Flex direction="column">
                      <Text fontWeight="medium">{jurisdiction.name}</Text>
                      <Text fontSize="xs" color="gray.600">
                        {jurisdiction.state}
                      </Text>
                    </Flex>
                  ) : (
                    boat.jurisdiction_id
                  )}
                </Table.Cell>
                <Table.Cell>
                  <BoatActionsMenu boat={boat} />
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table.Root>
      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={count}
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

export default BoatsList
