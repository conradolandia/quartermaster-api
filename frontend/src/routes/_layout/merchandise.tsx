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
  type MerchandisePublic,
  MerchandiseService,
} from "@/client"
import { MerchandiseActionsMenu } from "@/components/Common/MerchandiseActionsMenu"
import AddMerchandise from "@/components/Merchandise/AddMerchandise"
import PendingMerchandise from "@/components/Pending/PendingMerchandise"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"

type SortableColumn = "name" | "price" | "quantity_available" | "id"
type SortDirection = "asc" | "desc"

const merchandiseSearchSchema = z.object({
  page: z.number().catch(1),
  sortBy: z
    .enum(["name", "price", "quantity_available", "id"])
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

const PER_PAGE = 10

const sortMerchandise = (
  items: MerchandisePublic[],
  sortBy: SortableColumn | undefined,
  sortDirection: SortDirection | undefined,
) => {
  if (!sortBy || !sortDirection) return items

  return [...items].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal
    }
    return 0
  })
}

function getMerchandiseQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      MerchandiseService.readMerchandiseList({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
      }),
    queryKey: ["merchandise", { page }],
  }
}

export const Route = createFileRoute("/_layout/merchandise")({
  component: Merchandise,
  validateSearch: (search) => merchandiseSearchSchema.parse(search),
})

function MerchandiseTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, sortBy, sortDirection } = Route.useSearch()

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
    ...getMerchandiseQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
    queryKey: ["merchandise", { page, sortBy, sortDirection }],
  })

  const setPage = (page: number) =>
    navigate({
      search: (prev: Record<string, string | number | undefined>) => ({
        ...prev,
        page,
      }),
    })

  const items = sortMerchandise(
    data?.data.slice(0, PER_PAGE) ?? [],
    sortBy as SortableColumn | undefined,
    sortDirection as SortDirection | undefined,
  )
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingMerchandise />
  }

  if (items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiSearch />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>No merchandise yet</EmptyState.Title>
            <EmptyState.Description>
              Add catalog items to offer on trips
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
                display={{ base: "none", md: "table-cell" }}
              >
                Description
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("price")}
              >
                <Flex align="center">
                  Price
                  <SortIcon column="price" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("quantity_available")}
                display={{ base: "none", lg: "table-cell" }}
              >
                <Flex align="center">
                  Qty
                  <SortIcon column="quantity_available" />
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader
                w="sm"
                fontWeight="bold"
                cursor="pointer"
                onClick={() => handleSort("id")}
                display={{ base: "none", lg: "table-cell" }}
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
            {items.map((item) => (
              <Table.Row key={item.id} opacity={isPlaceholderData ? 0.5 : 1}>
                <Table.Cell truncate maxW="sm">
                  {item.name}
                </Table.Cell>
                <Table.Cell
                  truncate
                  maxW="xs"
                  display={{ base: "none", md: "table-cell" }}
                >
                  {item.description ?? "—"}
                </Table.Cell>
                <Table.Cell>{item.price.toFixed(2)}</Table.Cell>
                <Table.Cell display={{ base: "none", lg: "table-cell" }}>
                  {item.quantity_available}
                </Table.Cell>
                <Table.Cell display={{ base: "none", lg: "table-cell" }}>
                  {item.id}
                </Table.Cell>
                <Table.Cell>
                  <MerchandiseActionsMenu merchandise={item} />
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

function Merchandise() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" pt={12} pb={4}>
        <Heading size="lg">Merchandise Catalog</Heading>
        <Button onClick={() => setIsAddModalOpen(true)} colorScheme="blue">
          <Flex align="center" gap={2}>
            <FiPlus />
            <span>Add Merchandise</span>
          </Flex>
        </Button>
      </Flex>
      <AddMerchandise
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setIsAddModalOpen(false)}
      />
      <MerchandiseTable />
    </Container>
  )
}
