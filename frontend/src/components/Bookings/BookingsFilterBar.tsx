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
import { useState } from "react"
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
  onApplyBookingStatus: (statuses: string[]) => void
  onApplyPaymentStatus: (statuses: string[]) => void
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

/** Min width so all 6 filters fit on one row at ~1280px content width, but keep controls compact. */
const DESKTOP_FILTER_MIN_WIDTH = "100px"

/**
 * Computes a min width for a dropdown so the widest option label fits.
 * Measures rendered text in a hidden span (14px, normal weight). Safe for SSR (returns baseMin + padding).
 */
function getDropdownMinWidthFromLabels(
  items: Array<{ label: string }>,
  options?: { baseMin?: number; padding?: number },
): number {
  const { baseMin = 100, padding = 24 } = options ?? {}
  if (typeof window === "undefined") return baseMin + padding
  const maxLabelWidth = items.reduce((max, item) => {
    const span = document.createElement("span")
    span.style.visibility = "hidden"
    span.style.position = "absolute"
    span.style.fontSize = "14px"
    span.style.fontWeight = "400"
    span.style.fontFamily = "inherit"
    span.innerText = String(item.label)
    document.body.appendChild(span)
    const width = span.offsetWidth
    document.body.removeChild(span)
    return Math.max(max, width)
  }, 0)
  return maxLabelWidth + padding
}

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
  onApplyBookingStatus,
  onApplyPaymentStatus,
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
  const [isBookingMenuOpen, setIsBookingMenuOpen] = useState(false)
  const [draftBookingStatus, setDraftBookingStatus] = useState<string[]>(
    () => bookingStatusFilter,
  )
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false)
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<string[]>(
    () => paymentStatusFilter,
  )

  const bookingSelection = isBookingMenuOpen ? draftBookingStatus : bookingStatusFilter
  const paymentSelection = isPaymentMenuOpen ? draftPaymentStatus : paymentStatusFilter

  const getLabelForValue = (
    collection: FilterCollection,
    value: string | undefined,
  ): string => {
    const v = value ?? ""
    const match = collection.items.find((item) => item.value === v)
    if (match) return match.label
    return collection.items[0]?.label ?? ""
  }

  const missionLabel = getLabelForValue(missionsCollection, missionId)
  const tripLabel = getLabelForValue(tripsCollection, tripId)
  const tripTypeLabel = getLabelForValue(tripTypeFilterCollection, tripType)
  const boatLabel = getLabelForValue(
    boatsCollection,
    boatId && filteredBoats.some((b) => b.id === boatId) ? boatId : "",
  )

  const handleBookingMenuOpenChange = (details: { open: boolean }) => {
    if (details.open) {
      setDraftBookingStatus([...bookingStatusFilter])
      setIsBookingMenuOpen(true)
    } else {
      if (draftBookingStatus.length > 0) {
        onApplyBookingStatus(draftBookingStatus)
      }
      setIsBookingMenuOpen(false)
    }
  }

  const handlePaymentMenuOpenChange = (details: { open: boolean }) => {
    if (details.open) {
      setDraftPaymentStatus([...paymentStatusFilter])
      setIsPaymentMenuOpen(true)
    } else {
      if (draftPaymentStatus.length > 0) {
        onApplyPaymentStatus(draftPaymentStatus)
      }
      setIsPaymentMenuOpen(false)
    }
  }

  const toggleDraftBookingStatus = (status: string) => {
    setDraftBookingStatus((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
      return next.length === 0 ? prev : next
    })
  }

  const toggleDraftPaymentStatus = (status: string) => {
    setDraftPaymentStatus((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
      return next.length === 0 ? prev : next
    })
  }

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
            placeholder="Search code, name, email, phone (multiple words allowed)"
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "220px" }}
          >
            <MenuRoot
              closeOnSelect={false}
              positioning={{ sameWidth: true }}
              onOpenChange={handleBookingMenuOpenChange}
            >
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={{ base: "100%", lg: "100%" }}
                  borderColor="white"
                  justifyContent="space-between"
                >
                {bookingStatusLabel}
                <Icon as={FiChevronDown} ml={1} />
              </Button>
            </MenuTrigger>
            <MenuContent minWidth="140px">
              {BOOKING_STATUSES.map((status) => (
                <MenuCheckboxItem
                  key={status}
                  checked={bookingSelection.includes(status)}
                  onCheckedChange={() => toggleDraftBookingStatus(status)}
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "220px" }}
          >
            <MenuRoot
              closeOnSelect={false}
              positioning={{ sameWidth: true }}
              onOpenChange={handlePaymentMenuOpenChange}
            >
              <MenuTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  width={{ base: "100%", lg: "100%" }}
                  borderColor="white"
                  justifyContent="space-between"
                >
                {paymentStatusLabel}
                <Icon as={FiChevronDown} ml={1} />
              </Button>
            </MenuTrigger>
            <MenuContent minWidth="160px">
              {PAYMENT_STATUSES.map((status) => (
                <MenuCheckboxItem
                  key={status}
                  checked={paymentSelection.includes(status)}
                  onCheckedChange={() => toggleDraftPaymentStatus(status)}
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "350px" }}
          >
          <Select.Root
            collection={missionsCollection as any}
            size="xs"
            borderColor="white"
            value={missionId ? [missionId] : [""]}
            onValueChange={(e) => onMissionFilter(e.value[0] || undefined)}
            positioning={{ sameWidth: false }}
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {missionLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(missionsCollection.items)}
                maxWidth="350px"
                maxHeight="60vh"
                overflowY="auto"
              >
                {missionsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Box whiteSpace="normal" textOverflow="unset">
                      {item.label}
                    </Box>
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "260px" }}
          >
          <Select.Root
            collection={tripsCollection as any}
            size="xs"
            borderColor="white"
            value={tripId ? [tripId] : [""]}
            onValueChange={(e) => onTripFilter(e.value[0] || undefined)}
            positioning={{ sameWidth: false }}
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {tripLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(tripsCollection.items)}
                maxWidth="260px"
                maxHeight="60vh"
                overflowY="auto"
              >
                {tripsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Box whiteSpace="normal" textOverflow="unset">
                      {item.label}
                    </Box>
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "260px" }}
          >
          <Select.Root
            collection={tripTypeFilterCollection as any}
            size="xs"
            borderColor="white"
            value={tripType ? [tripType] : [""]}
            onValueChange={(e) =>
              onTripTypeFilter(e.value[0] || undefined)
            }
            positioning={{ sameWidth: false }}
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {tripTypeLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(tripTypeFilterCollection.items)}
                maxWidth="260px"
                maxHeight="60vh"
                overflowY="auto"
              >
                {tripTypeFilterCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Box whiteSpace="normal" textOverflow="unset">
                      {item.label}
                    </Box>
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
          <Box
            flex={1}
            minW={0}
            minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
            maxW={{ base: "100%", lg: "280px" }}
          >
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
            positioning={{ sameWidth: false }}
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {boatLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(boatsCollection.items)}
                maxWidth="200px"
                maxHeight="60vh"
                overflowY="auto"
              >
                {boatsCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Box whiteSpace="normal" textOverflow="unset">
                      {item.label}
                    </Box>
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
