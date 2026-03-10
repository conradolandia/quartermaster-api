import type { DiscountCodePublic } from "@/client"
import {
  Badge,
  Box,
  HStack,
  IconButton,
  Table,
  Text,
} from "@chakra-ui/react"
import { FiCopy, FiEdit, FiTrash2 } from "react-icons/fi"

import { formatCents } from "@/utils"

function formatRestrictions(
  dc: DiscountCodePublic,
  tableLaunches: Array<{ id: string; name: string }> | undefined,
  tableMissions: Array<{ id: string; name: string }> | undefined,
  tableTrips: Array<{ id: string; name?: string | null; type: string }> | undefined,
): string {
  const parts: string[] = []
  if (dc.restricted_trip_type) {
    parts.push(
      dc.restricted_trip_type === "launch_viewing"
        ? "Launch viewing"
        : "Pre-launch",
    )
  }
  if (dc.restricted_launch_id && tableLaunches?.length) {
    const launch = tableLaunches.find((l) => l.id === dc.restricted_launch_id)
    parts.push(launch ? launch.name : "Launch")
  }
  if (dc.restricted_mission_id && tableMissions?.length) {
    const mission = tableMissions.find(
      (m) => m.id === dc.restricted_mission_id,
    )
    parts.push(mission ? mission.name : "Mission")
  }
  if (dc.restricted_trip_id && tableTrips?.length) {
    const trip = tableTrips.find((t) => t.id === dc.restricted_trip_id)
    parts.push(trip ? trip.name || trip.type : "Trip")
  }
  return parts.length > 0 ? parts.join(", ") : "—"
}

interface DiscountCodesTableProps {
  discountCodes: DiscountCodePublic[] | undefined
  tableLaunches: Array<{ id: string; name: string }> | undefined
  tableMissions: Array<{ id: string; name: string }> | undefined
  tableTrips: Array<{ id: string; name?: string | null; type: string }> | undefined
  onEdit: (dc: DiscountCodePublic) => void
  onDelete: (id: string) => void
  buildBookingUrl: (code: string, isAccessCode: boolean) => string
  copyBookingUrl: (code: string, isAccessCode: boolean) => void
  isDeleting: boolean
}

export default function DiscountCodesTable({
  discountCodes,
  tableLaunches,
  tableMissions,
  tableTrips,
  onEdit,
  onDelete,
  buildBookingUrl,
  copyBookingUrl,
  isDeleting,
}: DiscountCodesTableProps) {
  return (
    <Box>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Code</Table.ColumnHeader>
            <Table.ColumnHeader>Description</Table.ColumnHeader>
            <Table.ColumnHeader>Type</Table.ColumnHeader>
            <Table.ColumnHeader>Value</Table.ColumnHeader>
            <Table.ColumnHeader>Uses</Table.ColumnHeader>
            <Table.ColumnHeader>Category</Table.ColumnHeader>
            <Table.ColumnHeader>Restrictions</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Booking URL</Table.ColumnHeader>
            <Table.ColumnHeader>Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {discountCodes?.map((discountCode) => (
            <Table.Row key={discountCode.id}>
              <Table.Cell>
                <Text fontWeight="medium">{discountCode.code}</Text>
              </Table.Cell>
              <Table.Cell>
                <Text
                  fontSize="sm"
                  color="text.muted"
                  maxW="200px"
                  truncate
                  title={discountCode.description || undefined}
                >
                  {discountCode.description || "—"}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Badge
                  size="lg"
                  colorPalette="green"
                  px={2}
                  py={0.5}
                >
                  {discountCode.discount_type === "percentage" ? "%" : "$"}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">
                  {discountCode.discount_type === "percentage"
                    ? `${(discountCode.discount_value <= 1
                        ? discountCode.discount_value * 100
                        : discountCode.discount_value
                      ).toFixed(0)}%`
                    : `$${formatCents(discountCode.discount_value)}`}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm">
                  {discountCode.used_count}
                  {discountCode.max_uses ? ` / ${discountCode.max_uses}` : ""}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Badge
                  size="sm"
                  colorPalette={
                    discountCode.is_access_code ? "purple" : "gray"
                  }
                >
                  {discountCode.is_access_code ? "Access Code" : "Discount"}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Text
                  fontSize="sm"
                  color="text.muted"
                  title={formatRestrictions(
                    discountCode,
                    tableLaunches,
                    tableMissions,
                    tableTrips,
                  )}
                  maxW="200px"
                  truncate
                >
                  {formatRestrictions(
                    discountCode,
                    tableLaunches,
                    tableMissions,
                    tableTrips,
                  )}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text
                  fontSize="sm"
                  color={discountCode.is_active ? "green.500" : "red.500"}
                >
                  {discountCode.is_active ? "Active" : "Inactive"}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <HStack gap={2} align="center">
                  <Text
                    fontSize="xs"
                    color="text.muted"
                    title={buildBookingUrl(
                      discountCode.code,
                      !!discountCode.is_access_code,
                    )}
                  >
                    /book?
                    {discountCode.is_access_code ? "access" : "discount"}=
                    {discountCode.code}
                  </Text>
                  <IconButton
                    aria-label="Copy booking URL to clipboard"
                    title="Copy booking URL"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyBookingUrl(
                        discountCode.code,
                        !!discountCode.is_access_code,
                      )
                    }
                  >
                    <FiCopy />
                  </IconButton>
                </HStack>
              </Table.Cell>
              <Table.Cell>
                <HStack>
                  <IconButton
                    aria-label="Edit discount code"
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(discountCode)}
                  >
                    <FiEdit />
                  </IconButton>
                  <IconButton
                    aria-label="Delete discount code"
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => onDelete(discountCode.id)}
                    loading={isDeleting}
                  >
                    <FiTrash2 />
                  </IconButton>
                </HStack>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {(!discountCodes || discountCodes.length === 0) && (
        <Text color="text.muted" textAlign="center" py={4}>
          No discount codes configured
        </Text>
      )}
    </Box>
  )
}
