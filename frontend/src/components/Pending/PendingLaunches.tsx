import { Skeleton, Table } from "@chakra-ui/react"

const PendingLaunches = () => {
  return (
    <Table.Root size={{ base: "sm", md: "md" }}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Launch Date</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Summary</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Location</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: 5 }).map((_, index) => (
          <Table.Row key={index}>
            <Table.Cell>
              <Skeleton height="20px" width="150px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" width="150px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" width="150px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" width="150px" />
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

export default PendingLaunches
