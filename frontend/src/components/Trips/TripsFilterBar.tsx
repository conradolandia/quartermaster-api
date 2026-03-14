import {
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Select,
  Text,
  type ListCollection,
} from "@chakra-ui/react"
import { FiX } from "react-icons/fi"

import { getDropdownMinWidthFromLabels } from "@/utils"

import { DESKTOP_FILTER_MIN_WIDTH } from "./types"

interface TripsFilterBarProps {
  missionId: string | undefined
  missionFilterLabel: string
  onMissionFilter: (missionId: string | undefined) => void
  missionsCollection: ListCollection<{ label: string; value: string }>
  tripType: string | undefined
  tripTypeFilterLabel: string
  onTripTypeFilter: (tripType: string | undefined) => void
  tripTypeCollection: ListCollection<{ label: string; value: string }>
  includeArchived: boolean
  onIncludeArchivedChange: (checked: boolean) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export default function TripsFilterBar({
  missionId,
  missionFilterLabel,
  onMissionFilter,
  missionsCollection,
  tripType,
  tripTypeFilterLabel,
  onTripTypeFilter,
  tripTypeCollection,
  includeArchived,
  onIncludeArchivedChange,
  hasActiveFilters,
  onClearFilters,
}: TripsFilterBarProps) {
  return (
    <Flex
      gap={3}
      align={{ base: "stretch", lg: "center" }}
      flexDirection={{ base: "column", lg: "row" }}
      flexWrap="wrap"
      mb={4}
    >
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
          maxW={{ base: "100%", lg: "260px" }}
        >
          <Select.Root
            collection={missionsCollection}
            size="xs"
            borderColor="white"
            value={missionId ? [missionId] : [""]}
            onValueChange={(e) =>
              onMissionFilter(e.value[0] || undefined)
            }
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {missionFilterLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(missionsCollection.items, { maxWidth: 260 })}
                maxWidth="260px"
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
          Type:
        </Text>
        <Box
          flex={1}
          minW={0}
          minWidth={{ base: undefined, lg: DESKTOP_FILTER_MIN_WIDTH }}
          maxW={{ base: "100%", lg: "260px" }}
        >
          <Select.Root
            collection={tripTypeCollection}
            size="xs"
            borderColor="white"
            value={tripType ? [tripType] : [""]}
            onValueChange={(e) =>
              onTripTypeFilter(e.value[0] || undefined)
            }
          >
            <Select.Control width="100%">
              <Select.Trigger justifyContent="space-between" width="100%">
                <Text fontSize="sm" flex="1" minW={0} textAlign="left">
                  {tripTypeFilterLabel}
                </Text>
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content
                minWidth={getDropdownMinWidthFromLabels(tripTypeCollection.items, { maxWidth: 260 })}
                maxWidth="260px"
                maxHeight="60vh"
                overflowY="auto"
              >
                {tripTypeCollection.items.map((item) => (
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
      <HStack gap={3} flexWrap="wrap">
        <Checkbox.Root
          checked={includeArchived}
          onCheckedChange={(e) =>
            onIncludeArchivedChange(e.checked === true)
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize="sm" color="text.secondary">
            Include archived
          </Checkbox.Label>
        </Checkbox.Root>
        <Button
          size="sm"
          variant="ghost"
          visibility={hasActiveFilters ? "visible" : "hidden"}
          disabled={!hasActiveFilters}
          onClick={onClearFilters}
        >
          <Flex align="center" gap={1}>
            <FiX />
            Clear filters
          </Flex>
        </Button>
      </HStack>
    </Flex>
  )
}
