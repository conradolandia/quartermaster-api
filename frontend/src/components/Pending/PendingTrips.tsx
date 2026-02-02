import { Table } from "@chakra-ui/react"
import { SkeletonText } from "../ui/skeleton"

const PendingTrips = () => (
  <Table.Root size={{ base: "sm", md: "md", lg: "lg" }}>
    <Table.Header>
      <Table.Row>
        <Table.ColumnHeader w={{ base: "sm", lg: "300px" }}>Name</Table.ColumnHeader>
        <Table.ColumnHeader w="sm" display={{ base: "none", md: "table-cell" }}>
          Trip Type
        </Table.ColumnHeader>
        <Table.ColumnHeader w="sm" display={{ base: "none", lg: "table-cell" }}>
          Mission
        </Table.ColumnHeader>
        <Table.ColumnHeader w="sm" minW="200px" display={{ base: "none", lg: "table-cell" }}>
          Schedule
        </Table.ColumnHeader>
        <Table.ColumnHeader w="sm" display={{ base: "none", lg: "table-cell" }}>
          Seats
        </Table.ColumnHeader>
        <Table.ColumnHeader w="sm" display={{ base: "none", lg: "table-cell" }}>
          Sales
        </Table.ColumnHeader>
        <Table.ColumnHeader w="sm">Boats</Table.ColumnHeader>
        <Table.ColumnHeader w="20" display={{ base: "none", lg: "table-cell" }}>
          Mode
        </Table.ColumnHeader>
        <Table.ColumnHeader w="20">Status</Table.ColumnHeader>
        <Table.ColumnHeader w="20">Actions</Table.ColumnHeader>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {[...Array(5)].map((_, index) => (
        <Table.Row key={index}>
          {[...Array(10)].map((_, cellIndex) => (
            <Table.Cell
              key={cellIndex}
              display={
                cellIndex === 1
                  ? { base: "none", md: "table-cell" }
                  : (cellIndex >= 2 && cellIndex <= 5) || cellIndex === 7
                    ? { base: "none", lg: "table-cell" }
                    : undefined
              }
            >
              <SkeletonText noOfLines={1} />
            </Table.Cell>
          ))}
        </Table.Row>
      ))}
    </Table.Body>
  </Table.Root>
)

export default PendingTrips
