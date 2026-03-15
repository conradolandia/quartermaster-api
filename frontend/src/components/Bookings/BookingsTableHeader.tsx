import { Flex, Table } from "@chakra-ui/react"

import type { SortableColumn } from "./types"
import SortIcon from "./shared/SortIcon"

interface BookingsTableHeaderProps {
  sortBy: SortableColumn
  sortDirection: "asc" | "desc"
  onSort: (column: SortableColumn) => void
}

export default function BookingsTableHeader({
  sortBy,
  sortDirection,
  onSort,
}: BookingsTableHeaderProps) {
  return (
    <Table.Header>
      <Table.Row>
        <Table.ColumnHeader
          w="28"
          minW="20"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("confirmation_code")}
        >
          <Flex align="center">
            Code
            <SortIcon column="confirmation_code" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="52"
          minW="40"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("last_name")}
        >
          <Flex align="center">
            Customer info
            <SortIcon column="last_name" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="36"
          minW="28"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("mission_name")}
        >
          <Flex align="center">
            Mission
            <SortIcon column="mission_name" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="32"
          minW="24"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("trip_name")}
        >
          <Flex align="center">
            Trip
            <SortIcon column="trip_name" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="40"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("boat_name")}
        >
          <Flex align="center">
            Boat
            <SortIcon column="boat_name" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="52"
          minW="180px"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("booking_status")}
        >
          <Flex align="center">
            Status
            <SortIcon column="booking_status" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="20"
          minW="5rem"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("total_amount")}
          whiteSpace="nowrap"
        >
          <Flex align="center">
            Total
            <SortIcon column="total_amount" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="16"
          fontWeight="bold"
          cursor="pointer"
          textAlign="center"
          onClick={() => onSort("total_quantity")}
        >
          <Flex align="center" justify="center">
            Qty
            <SortIcon column="total_quantity" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          w="36"
          minW="28"
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("created_at")}
        >
          <Flex align="center">
            Created at
            <SortIcon column="created_at" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader w="20" fontWeight="bold" whiteSpace="nowrap" textAlign="center">
          Actions
        </Table.ColumnHeader>
      </Table.Row>
    </Table.Header>
  )
}
