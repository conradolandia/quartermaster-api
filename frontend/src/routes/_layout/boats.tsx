import {
  Box,
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  Icon,
  Table,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FiArrowDown, FiArrowUp, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import {
  type BoatPublic,
  BoatsService,
} from "@/client"
import AddBoat from "@/components/Boats/AddBoat"
import BoatActionsMenu from "@/components/Common/BoatActionsMenu"
import PendingBoats from "@/components/Pending/PendingBoats"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import type { Boat } from "@/types/boat"

// Define sortable columns
type SortableColumn = "name" | "capacity" | "provider_id"
type SortDirection = "asc" | "desc"

const boatsSearchSchema = z.object({
  page: z.number().catch(1),
  jurisdictionId: z.string().optional(),
  sortBy: z
    .enum(["name", "capacity", "provider_id"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

const PER_PAGE = 5

// Helper function to convert BoatPublic to Boat
const convertToBoat = (boatPublic: BoatPublic): Boat => ({
  id: boatPublic.id,
  name: boatPublic.name,
  slug: boatPublic.slug,
  capacity: boatPublic.capacity,
  provider_id: boatPublic.provider_id,
  created_at: boatPublic.created_at,
  updated_at: boatPublic.updated_at,
  // Provider data from relationship or from get_boats_no_relationships
  provider_name: (boatPublic as any).provider_name || boatPublic.provider?.name || "",
  provider_location: (boatPublic as any).provider_location || boatPublic.provider?.location || "",
  provider_address: (boatPublic as any).provider_address || boatPublic.provider?.address || "",
  jurisdiction_id: (boatPublic as any).jurisdiction_id || boatPublic.provider?.jurisdiction_id || "",
  map_link: (boatPublic as any).map_link || boatPublic.provider?.map_link || null,
})

// Helper function to sort boats
const sortBoats = (
  boats: Boat[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return boats

  return [...boats].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    // Handle provider_id sorting by provider name
    if (sortBy === "provider_id") {
      aValue = a.provider_name || a.provider_id || ""
      bValue = b.provider_name || b.provider_id || ""
    }

    // Handle numeric sorting for capacity
    if (sortBy === "capacity") {
      aValue = Number(aValue)
      bValue = Number(bValue)
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

export const Route = createFileRoute("/_layout/boats")({
  component: Boats,
  validateSearch: (search) => boatsSearchSchema.parse(search),
})

function BoatsTable() {
  const { page, jurisdictionId, sortBy, sortDirection } = Route.useSearch()
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

  // Create the appropriate query function based on whether we have a jurisdictionId
  const queryFn = jurisdictionId
    ? () =>
        BoatsService.readBoatsByJurisdiction({
          jurisdictionId,
          skip: (page - 1) * PER_PAGE,
          limit: PER_PAGE,
        })
    : () =>
        BoatsService.readBoats({
          skip: (page - 1) * PER_PAGE,
          limit: PER_PAGE,
        })

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["boats", { page, jurisdictionId }],
    queryFn,
    placeholderData: (prevData) => prevData,
  })


  const setPage = (newPage: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page: newPage }),
    })

  // Convert BoatPublic to Boat and sort them
  const boats = sortBoats(
    (data?.data.slice(0, PER_PAGE) ?? []).map(convertToBoat),
    sortBy,
    sortDirection,
  )
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
    <>
      <Box overflowX="auto">
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
                onClick={() => handleSort("capacity")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  Capacity
                  <SortIcon column="capacity" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("provider_id")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Provider
                  <SortIcon column="provider_id" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
        <Table.Body>
          {boats.map((boat) => (
              <Table.Row key={boat.id} opacity={isPlaceholderData ? 0.5 : 1}>
                <Table.Cell truncate maxW="sm">
                  {boat.name}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
                  {boat.capacity}
                </Table.Cell>
                <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                  {boat.provider_name || "—"}
                </Table.Cell>
                <Table.Cell>
                  <BoatActionsMenu boat={boat} />
                </Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
        </Table.Root>
      </Box>
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

function Boats() {
  const [isAddBoatOpen, setIsAddBoatOpen] = useState(false)

  const handleAddBoatSuccess = () => {
    setIsAddBoatOpen(false)
  }

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Boats Management</Heading>
        <Button onClick={() => setIsAddBoatOpen(true)} colorScheme="blue">
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Boat</span>
          </Flex>
        </Button>
      </Flex>

      <AddBoat
        isOpen={isAddBoatOpen}
        onClose={() => setIsAddBoatOpen(false)}
        onSuccess={handleAddBoatSuccess}
      />

      <BoatsTable />
    </Container>
  )
}
