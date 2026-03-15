import { Flex, Table } from "@chakra-ui/react"

import type { SortableColumn } from "./types"
import SortIcon from "./shared/SortIcon"

interface TripsTableHeaderProps {
  sortBy: SortableColumn
  sortDirection: "asc" | "desc"
  onSort: (column: SortableColumn) => void
}

export default function TripsTableHeader({
  sortBy,
  sortDirection,
  onSort,
}: TripsTableHeaderProps) {
  return (
    <Table.Header>
      <Table.Row>
        <Table.ColumnHeader
          minW="8rem"
          px={1}
          pl={3}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("name")}
        >
          <Flex align="center">
            Name
            <SortIcon column="name" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="6rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("type")}
        >
          <Flex align="center">
            Trip Type
            <SortIcon column="type" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="6rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("mission_id")}
        >
          <Flex align="center">
            Mission
            <SortIcon column="mission_id" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="8rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("departure_time")}
        >
          <Flex align="center">
            Departure
            <SortIcon column="departure_time" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="3rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("total_bookings")}
          textAlign="center"
        >
          <Flex align="center" justify="center">
            Seats
            <SortIcon column="total_bookings" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="4rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("total_sales")}
        >
          <Flex align="center">
            Sales
            <SortIcon column="total_sales" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="6rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("boat_names")}
        >
          <Flex align="center">
            Boats
            <SortIcon column="boat_names" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="4.5rem"
          px={1}
          fontWeight="bold"
          textAlign="center"
        >
          Mode
        </Table.ColumnHeader>
        <Table.ColumnHeader
          minW="4.5rem"
          px={1}
          fontWeight="bold"
          cursor="pointer"
          onClick={() => onSort("active")}
          textAlign="center"
        >
          <Flex align="center" justify="center">
            Status
            <SortIcon column="active" sortBy={sortBy} sortDirection={sortDirection} />
          </Flex>
        </Table.ColumnHeader>
        <Table.ColumnHeader minW="5rem" px={1} fontWeight="bold">
          Actions
        </Table.ColumnHeader>
      </Table.Row>
    </Table.Header>
  )
}
