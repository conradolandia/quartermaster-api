import {
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Icon,
  Input,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react"
import type { Ref } from "react"
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi"

import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu"
import { InputGroup } from "@/components/ui/input-group"
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "./types"

export interface FilterCollection {
  items: Array<{ label: string; value: string }>
}

interface BookingsFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef: Ref<HTMLInputElement>
  includeArchived: boolean
  onIncludeArchivedChange: (checked: boolean) => void
  bookingStatusLabel: string
  paymentStatusLabel: string
  bookingStatusFilter: string[]
  paymentStatusFilter: string[]
  onToggleBookingStatus: (status: string) => void
  onTogglePaymentStatus: (status: string) => void
  missionId: string | undefined
  onMissionFilter: (missionId: string | undefined) => void
  missionsCollection: FilterCollection
  tripId: string | undefined
  onTripFilter: (tripId: string | undefined) => void
  tripsCollection: FilterCollection
  tripType: string | undefined
  onTripTypeFilter: (tripType: string | undefined) => void
  tripTypeFilterCollection: FilterCollection
  boatId: string | undefined
  onBoatFilter: (boatId: string | undefined) => void
  boatsCollection: FilterCollection
  filteredBoats: Array<{ id: string }>
  hasActiveFilters: boolean
  onClearFilters: () => void
}

const FILTER_SELECT_WIDTH = "160px"

export default function BookingsFilterBar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  includeArchived,
  onIncludeArchivedChange,
  bookingStatusLabel,
  paymentStatusLabel,
  bookingStatusFilter,
  paymentStatusFilter,
  onToggleBookingStatus,
  onTogglePaymentStatus,
  missionId,
  onMissionFilter,
  missionsCollection,
  tripId,
  onTripFilter,
  tripsCollection,
  tripType,
  onTripTypeFilter,
  tripTypeFilterCollection,
  boatId,
  onBoatFilter,
  boatsCollection,
  filteredBoats,
  hasActiveFilters,
  onClearFilters,
}: BookingsFilterBarProps) {
  return (
    <VStack key="bookings-filter-bar" align="stretch" gap={3} mb={4}>
      <Flex align="center" gap={3} flexWrap="wrap">
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Search:
        </Text>
        <InputGroup
          width="480px"
          maxWidth="100%"
          startElement={
            <Icon as={FiSearch} color="text.muted" boxSize={4} />
          }
        >
          <Input
            ref={searchInputRef}
            size="xs"
            placeholder="Search code, name, email, phone"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            borderColor="white"
          />
        </InputGroup>
        <Checkbox.Root
          checked={includeArchived}
          onCheckedChange={(e) => onIncludeArchivedChange(e.checked === true)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize="sm" color="text.secondary">
            Include archived
          </Checkbox.Label>
        </Checkbox.Root>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            <Flex align="center" gap={1}>
              <FiX />
              Clear filters
            </Flex>
          </Button>
        )}
      </Flex>
      <Flex
        gap={3}
        align={{ base: "stretch", lg: "center" }}
        flexDirection={{ base: "column", lg: "row" }}
        flexWrap="wrap"
      >
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Booking:
          </Text>
          <Box flex={1} minW={0}>
            <MenuRoot closeOnSelect={false} positioning={{ sameWidth: true }}>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={{ base: "100%", lg: FILTER_SELECT_WIDTH }}
                  borderColor="white"
                  justifyContent="space-between"
                >
                {bookingStatusLabel}
                <Icon as={FiChevronDown} ml={1} />
              </Button>
            </MenuTrigger>
            <MenuContent minWidth="180px">
              {BOOKING_STATUSES.map((status) => (
                <MenuCheckboxItem
                  key={status}
                  checked={bookingStatusFilter.includes(status)}
                  onCheckedChange={() => onToggleBookingStatus(status)}
                  value={status}
                >
                  {status.replace(/_/g, " ").toUpperCase()}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </MenuRoot>
        </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Payment:
          </Text>
          <Box flex={1} minW={0}>
            <MenuRoot closeOnSelect={false} positioning={{ sameWidth: true }}>
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={{ base: "100%", lg: FILTER_SELECT_WIDTH }}
                  borderColor="white"
                  justifyContent="space-between"
                >
                {paymentStatusLabel}
                <Icon as={FiChevronDown} ml={1} />
              </Button>
            </MenuTrigger>
            <MenuContent minWidth="200px">
              {PAYMENT_STATUSES.map((status) => (
                <MenuCheckboxItem
                  key={status}
                  checked={paymentStatusFilter.includes(status)}
                  onCheckedChange={() => onTogglePaymentStatus(status)}
                  value={status}
                >
                  {status.replace(/_/g, " ").toUpperCase()}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </MenuRoot>
        </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Mission:
          </Text>
          <Box flex={1} minW={0}>
          <Select.Root
            collection={missionsCollection as any}
            size="xs"
            borderColor="white"
            value={missionId ? [missionId] : [""]}
            onValueChange={(e) => onMissionFilter(e.value[0] || undefined)}
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All Missions" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="300px" maxHeight="60vh" overflowY="auto">
                {missionsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Trip:
          </Text>
          <Box flex={1} minW={0}>
          <Select.Root
            collection={tripsCollection as any}
            size="xs"
            borderColor="white"
            value={tripId ? [tripId] : [""]}
            onValueChange={(e) => onTripFilter(e.value[0] || undefined)}
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All Trips" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="320px" maxHeight="60vh" overflowY="auto">
                {tripsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Type:
          </Text>
          <Box flex={1} minW={0}>
          <Select.Root
            collection={tripTypeFilterCollection as any}
            size="xs"
            borderColor="white"
            value={tripType ? [tripType] : [""]}
            onValueChange={(e) =>
              onTripTypeFilter(e.value[0] || undefined)
            }
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All Types" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="180px">
                {tripTypeFilterCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Box>
        </HStack>
        <HStack gap={3} minW={0} width={{ base: "100%", lg: "auto" }}>
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="text.secondary"
            flexShrink={0}
            w={{ base: "72px", lg: "auto" }}
          >
            Boat:
          </Text>
          <Box flex={1} minW={0}>
          <Select.Root
            collection={boatsCollection as any}
            size="xs"
            borderColor="white"
            value={
              boatId && filteredBoats.some((b) => b.id === boatId)
                ? [boatId]
                : [""]
            }
            onValueChange={(e) => onBoatFilter(e.value[0] || undefined)}
          >
            <Select.Control width="100%">
              <Select.Trigger>
                <Select.ValueText placeholder="All Boats" />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content minWidth="220px" maxHeight="60vh" overflowY="auto">
                {boatsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Box>
        </HStack>
      </Flex>
    </VStack>
  )
}
