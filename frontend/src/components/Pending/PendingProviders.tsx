import { Skeleton, Table } from "@chakra-ui/react"

const PendingProviders = () => {
  return (
    <Table.Root size={{ base: "sm", md: "md" }}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
          <Table.ColumnHeader
            w="sm"
            display={{ base: "none", md: "table-cell" }}
          >
            Location
          </Table.ColumnHeader>
          <Table.ColumnHeader
            w="sm"
            display={{ base: "none", lg: "table-cell" }}
          >
            Address
          </Table.ColumnHeader>
          <Table.ColumnHeader
            w="sm"
            display={{ base: "none", md: "table-cell" }}
          >
            Jurisdiction
          </Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {[1, 2, 3, 4, 5].map((i) => (
          <Table.Row key={i}>
            <Table.Cell>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell display={{ base: "none", md: "table-cell" }}>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell display={{ base: "none", lg: "table-cell" }}>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell display={{ base: "none", md: "table-cell" }}>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" width="40px" />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}

export default PendingProviders
