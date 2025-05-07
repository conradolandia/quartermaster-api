import {
  Button,
  Container,
  EmptyState,
  Flex,
  Heading,
  Table,
  VStack,
  Icon,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FiSearch, FiPlus, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { useState } from "react";
import { z } from "zod";

import { LocationsService, type LocationPublic } from "@/client";
import { LocationActionsMenu } from "@/components/Common/LocationActionsMenu";
import AddLocation from "@/components/Locations/AddLocation";
import PendingLocations from "@/components/Pending/PendingLocations";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx";

// Define sortable columns
type SortableColumn = "name" | "state" | "id";
type SortDirection = "asc" | "desc";

const locationsSearchSchema = z.object({
  page: z.number().catch(1),
  sortBy: z.enum(["name", "state", "id"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

const PER_PAGE = 5;

// Helper function to sort locations
const sortLocations = (locations: LocationPublic[], sortBy: SortableColumn | undefined, sortDirection: SortDirection | undefined) => {
  if (!sortBy || !sortDirection) return locations;

  return [...locations].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];

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

function getLocationsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      LocationsService.readLocations({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["locations", { page }],
  };
}

export const Route = createFileRoute("/_layout/locations")({
  component: Locations,
  validateSearch: (search) => locationsSearchSchema.parse(search),
});

function LocationsTable() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, sortBy, sortDirection } = Route.useSearch();

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

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getLocationsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
    queryKey: ["locations", { page, sortBy, sortDirection }],
  });

  const setPage = (page: number) =>
    navigate({
      search: (prev: { [key: string]: string }) => ({ ...prev, page }),
    });

  // Apply sorting to locations
  const locations = sortLocations(
    data?.data.slice(0, PER_PAGE) ?? [],
    sortBy as SortableColumn | undefined,
    sortDirection as SortDirection | undefined
  );
  const count = data?.count ?? 0;

  if (isLoading) {
    return <PendingLocations />;
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
    );
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
    <>
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
              onClick={() => handleSort("id")}
            >
              <Flex align="center">
                ID
                <SortIcon column="id" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm" fontWeight="bold">
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
              <Table.Cell truncate maxW="sm">
                {location.state}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {location.id}
              </Table.Cell>
              <Table.Cell>
                <LocationActionsMenu location={location} />
              </Table.Cell>
            </Table.Row>
          ))}
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
  );
}

function Locations() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
  );
}
