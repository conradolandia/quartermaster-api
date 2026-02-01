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
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiArrowDown, FiArrowUp, FiPlus, FiSearch } from "react-icons/fi"
import { z } from "zod"

import {
  type LocationPublic,
  LocationsService,
  UtilsService,
} from "@/client"
import { formatLocationTimezoneDisplay } from "@/utils"
import AddLocation from "@/components/Locations/AddLocation"
import DeleteLocation from "@/components/Locations/DeleteLocation"
import EditLocation from "@/components/Locations/EditLocation"
import PendingLocations from "@/components/Pending/PendingLocations"
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

// Define sortable columns
type SortableColumn = "name" | "state" | "timezone"
type SortDirection = "asc" | "desc"

const locationsSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  sortBy: z.enum(["name", "state", "timezone"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

// Helper function to sort locations
const sortLocations = (
  locations: LocationPublic[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return locations

  return [...locations].sort((a, b) => {
    const aValue: any = a[sortBy]
    const bValue: any = b[sortBy]

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

function getLocationsQueryOptions({
  page,
  pageSize,
}: {
  page: number
  pageSize: number
}) {
  return {
    queryFn: () =>
      LocationsService.readLocations({
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    queryKey: ["locations", { page, pageSize }],
  }
}

export const Route = createFileRoute("/_layout/locations")({
  component: Locations,
  validateSearch: (search) => locationsSearchSchema.parse(search),
})

/** Format state for display: "Full Name (XX)" using US states map, or just code. */
function formatStateDisplay(stateCode: string | null | undefined, stateNameByCode: Map<string, string>): string {
  if (!stateCode) return "—"
  const name = stateNameByCode.get(stateCode)
  return name ? `${name} (${stateCode})` : stateCode
}

function LocationsTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, pageSize, sortBy, sortDirection } = Route.useSearch()
  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE

  const { data: statesResponse } = useQuery({
    queryKey: ["us-states"],
    queryFn: () => UtilsService.getUsStates(),
    staleTime: 1000 * 60 * 60,
  })
  const stateNameByCode = useMemo(() => {
    const list = (statesResponse as { data?: Array<{ code: string; name: string }> })?.data ?? []
    return new Map(list.map((s) => [s.code, s.name]))
  }, [statesResponse])

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

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getLocationsQueryOptions({ page, pageSize: effectivePageSize }),
    placeholderData: (prevData) => prevData,
    queryKey: ["locations", { page, pageSize: effectivePageSize, sortBy, sortDirection }],
  })

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

  // Apply sorting to locations
  const locations = sortLocations(
    data?.data.slice(0, effectivePageSize) ?? [],
    sortBy as SortableColumn | undefined,
    sortDirection as SortDirection | undefined,
  )
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingLocations />
  }

  if (locations.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>
              You don't have any locations yet
            </EmptyState.Title>
            <EmptyState.Description>
              Add a new location to get started
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
                onClick={() => handleSort("state")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  State
                  <SortIcon column="state" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("timezone")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Timezone
                  <SortIcon column="timezone" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold" textAlign="center">
                Actions
              </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {locations?.map((location) => (
            <Table.Row key={location.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell truncate maxW="sm">
                {location.name}
              </Table.Cell>
              <Table.Cell truncate maxW="sm" display={{ base: "none", md: "table-cell" }}>
                {formatStateDisplay(location.state, stateNameByCode)}
              </Table.Cell>
              <Table.Cell truncate maxW="sm" display={{ base: "none", lg: "table-cell" }}>
                {formatLocationTimezoneDisplay(location.timezone ?? "UTC")}
              </Table.Cell>
              <Table.Cell textAlign="center">
                <Flex gap={2} flexWrap="wrap" justify="center">
                  <EditLocation location={location} />
                  <DeleteLocation id={location.id} />
                </Flex>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        </Table.Root>
      </Box>
      {count > 0 && (
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
    </>
  )
}

function Locations() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Locations Management</Heading>
        <Button onClick={() => setIsAddModalOpen(true)} colorScheme="blue">
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Location</span>
          </Flex>
        </Button>
      </Flex>
      <AddLocation
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <LocationsTable />
    </Container>
  )
}
