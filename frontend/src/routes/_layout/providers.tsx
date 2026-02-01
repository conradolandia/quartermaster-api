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

import { type ProviderPublic, ProvidersService } from "@/client"
import PendingProviders from "@/components/Pending/PendingProviders"
import AddProvider from "@/components/Providers/AddProvider"
import DeleteProvider from "@/components/Providers/DeleteProvider"
import EditProvider from "@/components/Providers/EditProvider"
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
type SortableColumn = "name" | "jurisdiction_id"
type SortDirection = "asc" | "desc"

const providersSearchSchema = z.object({
  page: z.number().catch(1),
  pageSize: z.number().catch(DEFAULT_PAGE_SIZE),
  jurisdictionId: z.string().optional(),
  sortBy: z.enum(["name", "jurisdiction_id"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

// Helper function to sort providers
const sortProviders = (
  providers: ProviderPublic[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return providers

  return [...providers].sort((a, b) => {
    let aValue: any = a[sortBy]
    let bValue: any = b[sortBy]

    // Special handling for jurisdiction_id - sort by jurisdiction name
    if (sortBy === "jurisdiction_id") {
      // Providers have jurisdiction relationship loaded
      aValue = a.jurisdiction?.name || a.jurisdiction_id || ""
      bValue = b.jurisdiction?.name || b.jurisdiction_id || ""
    }

    // Handle string sorting
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return 0
  })
}

function getProvidersQueryOptions({
  page,
  pageSize,
  jurisdictionId,
}: {
  page: number
  pageSize: number
  jurisdictionId?: string
}) {
  return {
    queryFn: () =>
      ProvidersService.readProviders({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        jurisdictionId,
      }),
    queryKey: ["providers", { page, pageSize, jurisdictionId }],
  }
}

export const Route = createFileRoute("/_layout/providers")({
  component: Providers,
  validateSearch: (search) => providersSearchSchema.parse(search),
})

function ProvidersTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, pageSize, jurisdictionId, sortBy, sortDirection } =
    Route.useSearch()
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

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getProvidersQueryOptions({
      page,
      pageSize: effectivePageSize,
      jurisdictionId,
    }),
    placeholderData: (prevData) => prevData,
    queryKey: [
      "providers",
      {
        page,
        pageSize: effectivePageSize,
        jurisdictionId,
        sortBy,
        sortDirection,
      },
    ],
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

  // Apply sorting to providers
  const providers = sortProviders(
    data?.data.slice(0, effectivePageSize) ?? [],
    sortBy as SortableColumn | undefined,
    sortDirection as SortDirection | undefined,
  )
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingProviders />
  }

  if (providers.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>
              You don't have any providers yet
            </EmptyState.Title>
            <EmptyState.Description>
              Add a new provider to get started
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
                display={{ base: "none", lg: "table-cell" }}
              >
                Address
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("jurisdiction_id")}
                display={{ base: "none", md: "table-cell" }}
              >
                <Flex align="center">
                  Jurisdiction
                  <SortIcon column="jurisdiction_id" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader w="sm" fontWeight="bold" textAlign="center">
                Actions
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {providers?.map((provider) => (
              <Table.Row
                key={provider.id}
                opacity={isPlaceholderData ? 0.5 : 1}
              >
                <Table.Cell truncate maxW="sm">
                  {provider.name}
                </Table.Cell>
                <Table.Cell
                  truncate
                  maxW="sm"
                  display={{ base: "none", lg: "table-cell" }}
                >
                  {provider.address || "—"}
                </Table.Cell>
                <Table.Cell
                  truncate
                  maxW="sm"
                  display={{ base: "none", md: "table-cell" }}
                >
                  {provider.jurisdiction?.name ||
                    provider.jurisdiction_id ||
                    "—"}
                </Table.Cell>
                <Table.Cell textAlign="center">
                  <Flex gap={2} flexWrap="wrap" justify="center">
                    <EditProvider provider={provider} />
                    <DeleteProvider provider={provider} />
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

function Providers() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Providers Management</Heading>
        <Button onClick={() => setIsAddModalOpen(true)} colorScheme="blue">
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Provider</span>
          </Flex>
        </Button>
      </Flex>
      <AddProvider
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <ProvidersTable />
    </Container>
  )
}
