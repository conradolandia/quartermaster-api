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

import {
  JurisdictionsService,
  LocationsService,
  type JurisdictionPublic,
} from "@/client";
import AddJurisdiction from "@/components/Jurisdictions/AddJurisdiction";
import JurisdictionActionsMenu from "@/components/Common/JurisdictionActionsMenu";
import PendingJurisdictions from "@/components/Pending/PendingJurisdictions";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx";

// Define sortable columns
type SortableColumn = "name" | "state" | "sales_tax_rate" | "location_id";
type SortDirection = "asc" | "desc";

const jurisdictionsSearchSchema = z.object({
  page: z.number().catch(1),
  locationId: z.string().optional(),
  sortBy: z.enum(["name", "state", "sales_tax_rate", "location_id"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

const PER_PAGE = 5;

// Helper function to sort jurisdictions
const sortJurisdictions = (
  jurisdictions: JurisdictionPublic[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
  locationsMap: Map<string, any>
) => {
  if (!sortBy || !sortDirection) return jurisdictions;

  return [...jurisdictions].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];

    // Special handling for location_id - sort by location name
    if (sortBy === "location_id") {
      aValue = locationsMap.get(a.location_id)?.name || a.location_id;
      bValue = locationsMap.get(b.location_id)?.name || b.location_id;
    }

    // Special handling for sales_tax_rate - convert to number
    if (sortBy === "sales_tax_rate") {
      aValue = parseFloat(String(a.sales_tax_rate));
      bValue = parseFloat(String(b.sales_tax_rate));
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle numeric sorting
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
};

function getJurisdictionsQueryOptions({
  page,
  locationId,
}: {
  page: number;
  locationId?: string;
}) {
  return {
    queryFn: () =>
      JurisdictionsService.readJurisdictions({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        locationId,
      }),
    queryKey: ["jurisdictions", { page, locationId }],
  };
}

// Function to create a map of location IDs to location objects
function useLocationsMap() {
  const { data } = useQuery({
    queryKey: ["locations-map"],
    queryFn: () => LocationsService.readLocations({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const locationsMap = new Map();
  if (data?.data) {
    data.data.forEach((location) => {
      locationsMap.set(location.id, location);
    });
  }

  return locationsMap;
}

export const Route = createFileRoute("/_layout/jurisdictions")({
  component: Jurisdictions,
  validateSearch: (search) => jurisdictionsSearchSchema.parse(search),
});

function JurisdictionsTable() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, locationId, sortBy, sortDirection } = Route.useSearch();
  const locationsMap = useLocationsMap();

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
    ...getJurisdictionsQueryOptions({ page, locationId }),
    placeholderData: (prevData) => prevData,
    queryKey: ["jurisdictions", { page, locationId, sortBy, sortDirection }],
  });

  const setPage = (page: number) =>
    navigate({
      search: (prev: { [key: string]: string | number }) => ({ ...prev, page }),
    });

  // Apply sorting to jurisdictions
  const jurisdictions = sortJurisdictions(
    data?.data.slice(0, PER_PAGE) ?? [],
    sortBy as SortableColumn | undefined,
    sortDirection as SortDirection | undefined,
    locationsMap
  );
  const count = data?.count ?? 0;

  if (isLoading) {
    return <PendingJurisdictions />;
  }

  if (jurisdictions.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>
              You don't have any jurisdictions yet
            </EmptyState.Title>
            <EmptyState.Description>
              Add a new jurisdiction to get started
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
              onClick={() => handleSort("sales_tax_rate")}
            >
              <Flex align="center">
                Sales Tax Rate
                <SortIcon column="sales_tax_rate" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader
              w="sm"
              fontWeight="bold"
              cursor="pointer"
              onClick={() => handleSort("location_id")}
            >
              <Flex align="center">
                Location
                <SortIcon column="location_id" />
              </Flex>
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm" fontWeight="bold">
              Actions
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {jurisdictions?.map((jurisdiction) => (
            <Table.Row
              key={jurisdiction.id}
              opacity={isPlaceholderData ? 0.5 : 1}
            >
              <Table.Cell truncate maxW="sm">
                {jurisdiction.name}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {jurisdiction.state}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {jurisdiction.sales_tax_rate}%
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {locationsMap.get(jurisdiction.location_id)?.name ||
                  jurisdiction.location_id}
              </Table.Cell>
              <Table.Cell>
                <JurisdictionActionsMenu jurisdiction={jurisdiction} />
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

function Jurisdictions() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Jurisdictions Management</Heading>
        <Button onClick={() => setIsAddModalOpen(true)} colorScheme="blue">
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Jurisdiction</span>
          </Flex>
        </Button>
      </Flex>
      <AddJurisdiction
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <JurisdictionsTable />
    </Container>
  );
}
