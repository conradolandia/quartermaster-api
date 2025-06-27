import { Skeleton, Table } from "@chakra-ui/react"

const PendingBookings = () => {
  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
            <Table.ColumnHeader w="sm">
              <Skeleton height="20px" />
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: 5 }).map((_, index) => (
            <Table.Row key={index}>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
              <Table.Cell>
                <Skeleton height="20px" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  )
}

export default PendingBookings
