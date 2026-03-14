import {
  Box,
  Button,
  EmptyState,
  Flex,
  Icon,
  Table,
  VStack,
} from "@chakra-ui/react"
import {
  createListCollection,
  type ListCollection,
} from "@chakra-ui/react"
import { FiSearch, FiX } from "react-icons/fi"

import type { TripsSearch } from "@/routes/_layout/trips"
import PendingTrips from "@/components/Pending/PendingTrips"
import { DEFAULT_PAGE_SIZE, PageSizeSelect } from "@/components/ui/page-size-select"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination"
import { useDateFormatPreference } from "@/contexts/DateFormatContext"
import { useIncludeArchived } from "@/contexts/IncludeArchivedContext"
import { TRIP_TYPES, getLabelForValue, type SortableColumn, type SortDirection } from "./types"
import TripsFilterBar from "./TripsFilterBar"
import TripsTableHeader from "./TripsTableHeader"
import TripsTableRow from "./TripsTableRow"
import { useTripsListQueries } from "./hooks/useTripsListQueries"

interface TripsTableProps {
  search: TripsSearch
  onSearchChange: (updates: Partial<TripsSearch>) => void
}

export default function TripsTable({ search, onSearchChange }: TripsTableProps) {
  useDateFormatPreference()
  const {
    page,
    pageSize,
    sortBy,
    sortDirection,
    missionId,
    tripType,
  } = search
  const { includeArchived, setIncludeArchived } = useIncludeArchived()

  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE
  const effectiveSortBy = (sortBy || "check_in_time") as SortableColumn
  const effectiveSortDirection = (sortDirection || "desc") as SortDirection

  const {
    tripsToShow,
    count,
    isLoading,
    isPlaceholderData,
    missionsMap,
    tripBoatsByTrip,
    missionsForDropdown,
  } = useTripsListQueries({
    page,
    pageSize: effectivePageSize,
    missionId,
    tripType,
    includeArchived,
    sortBy: effectiveSortBy,
    sortDirection: effectiveSortDirection,
  })

  const handleSort = (column: SortableColumn) => {
    const currentSortBy = sortBy || "check_in_time"
    const currentSortDirection = sortDirection || "desc"
    const newDirection: SortDirection =
      currentSortBy === column && currentSortDirection === "desc"
        ? "asc"
        : "desc"
    onSearchChange({ sortBy: column, sortDirection: newDirection })
  }

  const setPage = (newPage: number) => onSearchChange({ page: newPage })
  const setPageSize = (newPageSize: number) =>
    onSearchChange({ pageSize: newPageSize, page: 1 })
  const handlePageChange = (details: { page: number }) => setPage(details.page)

  const handleMissionFilter = (selectedMissionId?: string) =>
    onSearchChange({
      missionId: selectedMissionId || undefined,
      page: 1,
    })

  const handleTripTypeFilter = (selectedTripType?: string) =>
    onSearchChange({
      tripType: selectedTripType || undefined,
      page: 1,
    })

  const handleClearFilters = () =>
    onSearchChange({
      missionId: undefined,
      tripType: undefined,
      page: 1,
    })

  const handleIncludeArchivedChange = (checked: boolean) => {
    setIncludeArchived(checked)
    onSearchChange({ page: 1 })
  }

  const missionsCollection = createListCollection({
    items: [
      { label: "All Missions", value: "" },
      ...missionsForDropdown.map((m) => ({
        label: m.name,
        value: m.id,
      })),
    ],
  })

  const tripTypeCollection = createListCollection({
    items: TRIP_TYPES.map((t) => ({ label: t.label, value: t.value })),
  })

  const missionFilterLabel = getLabelForValue(
    missionsCollection as unknown as { items: Array<{ label: string; value: string }> },
    missionId,
  )
  const tripTypeFilterLabel = getLabelForValue(
    tripTypeCollection as unknown as { items: Array<{ label: string; value: string }> },
    tripType,
  )

  if (isLoading) {
    return <PendingTrips />
  }

  const hasActiveFilters = !!(missionId || tripType)
  const isEmpty = tripsToShow.length === 0

  return (
    <>
      <TripsFilterBar
        missionId={missionId}
        missionFilterLabel={missionFilterLabel}
        onMissionFilter={handleMissionFilter}
        missionsCollection={missionsCollection as ListCollection<{ label: string; value: string }>}
        tripType={tripType}
        tripTypeFilterLabel={tripTypeFilterLabel}
        onTripTypeFilter={handleTripTypeFilter}
        tripTypeCollection={tripTypeCollection as ListCollection<{ label: string; value: string }>}
        includeArchived={includeArchived}
        onIncludeArchivedChange={handleIncludeArchivedChange}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {isEmpty ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <FiSearch />
            </EmptyState.Indicator>
            <VStack textAlign="center" gap={3}>
              <EmptyState.Title>
                {hasActiveFilters
                  ? "No trips match your filters"
                  : "You don't have any trips yet"}
              </EmptyState.Title>
              <EmptyState.Description>
                {hasActiveFilters
                  ? "Try adjusting your filters or clear them to see all trips."
                  : "Add a new trip to get started"}
              </EmptyState.Description>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearFilters}
                >
                  <Flex align="center" gap={1}>
                    <Icon as={FiX} />
                    Clear filters
                  </Flex>
                </Button>
              )}
            </VStack>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          <Box overflowX="auto">
            <Table.Root
              size="sm"
              width="100%"
              minW="max-content"
            >
              <TripsTableHeader
                sortBy={effectiveSortBy}
                sortDirection={effectiveSortDirection}
                onSort={handleSort}
              />
              <Table.Body>
                {tripsToShow.map((trip) => (
                  <TripsTableRow
                    key={trip.id}
                    trip={trip}
                    missionName={missionsMap.get(trip.mission_id)?.name ?? "Unknown"}
                    boats={tripBoatsByTrip[trip.id] ?? []}
                    isPlaceholderData={isPlaceholderData}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          {count > 0 && (
            <Flex
              justifyContent="space-between"
              align="center"
              flexWrap="wrap"
              gap={4}
              mt={4}
            >
              <PageSizeSelect
                value={effectivePageSize}
                onChange={setPageSize}
              />
              {count > effectivePageSize && (
                <PaginationRoot
                  page={page}
                  count={count}
                  pageSize={effectivePageSize}
                  siblingCount={1}
                  onPageChange={handlePageChange}
                >
                  <Flex>
                    <PaginationPrevTrigger />
                    <PaginationItems />
                    <PaginationNextTrigger />
                  </Flex>
                </PaginationRoot>
              )}
            </Flex>
          )}
        </>
      )}
    </>
  )
}
