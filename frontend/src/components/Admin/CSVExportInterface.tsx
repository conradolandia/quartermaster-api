import {
  Box,
  Button,
  Card,
  HStack,
  Heading,
  Select,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FiDownload, FiFilter } from "react-icons/fi"

import {
  BookingsService,
  MissionsService,
  TripsService,
  type MissionPublic,
  type TripPublic,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"

const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "refunded",
  "pending_payment",
]

const CSVExportInterface = () => {
  const [selectedMissionId, setSelectedMissionId] = useState("")
  const [selectedTripId, setSelectedTripId] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Fetch missions for filtering
  const { data: missionsData } = useQuery({
    queryKey: ["missions"],
    queryFn: () => MissionsService.readMissions({ limit: 100 }),
  })

  // Fetch trips for filtering
  const { data: tripsData } = useQuery({
    queryKey: ["trips"],
    queryFn: () => TripsService.readTrips({ limit: 100 }),
  })

  const missions = missionsData?.data || []
  const trips = tripsData?.data || []

  // Filter trips by selected mission
  const filteredTrips = selectedMissionId
    ? trips.filter((trip: TripPublic) => trip.mission_id === selectedMissionId)
    : trips

  const missionsCollection = createListCollection({
    items: missions.map((mission: MissionPublic) => ({
      label: mission.name,
      value: mission.id,
    })),
  })

  const tripsCollection = createListCollection({
    items: filteredTrips.map((trip: TripPublic) => ({
      label: `${trip.type} - ${new Date(trip.departure_time).toLocaleDateString()}`,
      value: trip.id,
    })),
  })

  const statusCollection = createListCollection({
    items: BOOKING_STATUSES.map((status) => ({
      label: status.replace("_", " ").toUpperCase(),
      value: status,
    })),
  })

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Build query parameters
      const params = new URLSearchParams()
      if (selectedMissionId) params.append("mission_id", selectedMissionId)
      if (selectedTripId) params.append("trip_id", selectedTripId)
      if (selectedStatus) params.append("booking_status", selectedStatus)

      // Make the API call
      const response = await BookingsService.exportBookingsCsv({
        missionId: selectedMissionId || undefined,
        tripId: selectedTripId || undefined,
        bookingStatus: selectedStatus || undefined,
      })

      // Create download link
      const blob = new Blob([response as BlobPart], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // Generate filename based on filters
      let filename = "bookings_export"
      if (selectedMissionId) {
        const mission = missions.find((m: MissionPublic) => m.id === selectedMissionId)
        filename += `_${mission?.name?.replace(/\s+/g, "_") || "mission"}`
      }
      if (selectedTripId) {
        const trip = trips.find((t: TripPublic) => t.id === selectedTripId)
        filename += `_${trip?.type?.replace(/\s+/g, "_") || "trip"}`
      }
      if (selectedStatus) {
        filename += `_${selectedStatus}`
      }
      filename += ".csv"

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      showSuccessToast("CSV export completed successfully!")
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.detail || "Failed to export CSV data",
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleReset = () => {
    setSelectedMissionId("")
    setSelectedTripId("")
    setSelectedStatus("")
  }

  const canExport = !isExporting

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">CSV Export</Heading>

      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={6} align="stretch">
            <Heading size="md">Export Passenger Manifest</Heading>
            <Text color="text.muted">
              Export booking data to CSV format with optional filtering by mission, trip, or status.
            </Text>

            {/* Filters */}
            <VStack gap={4} align="stretch">
              <HStack gap={4} align="end">
                <Box flex={1}>
                  <Text fontWeight="medium" mb={2}>
                    Mission (Optional)
                  </Text>
                  <Select.Root
                    collection={missionsCollection}
                    value={selectedMissionId ? [selectedMissionId] : []}
                    onValueChange={(details) => {
                      setSelectedMissionId(details.value[0] || "")
                      setSelectedTripId("") // Reset trip when mission changes
                    }}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText placeholder="All missions" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content minWidth="300px">
                        {missionsCollection.items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Box>

                <Box flex={1}>
                  <Text fontWeight="medium" mb={2}>
                    Trip (Optional)
                  </Text>
                  <Select.Root
                    collection={tripsCollection}
                    value={selectedTripId ? [selectedTripId] : []}
                    onValueChange={(details) => setSelectedTripId(details.value[0] || "")}
                    disabled={!selectedMissionId}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText placeholder={selectedMissionId ? "All trips" : "Select mission first"} />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content minWidth="300px">
                        {tripsCollection.items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Box>

                <Box flex={1}>
                  <Text fontWeight="medium" mb={2}>
                    Status (Optional)
                  </Text>
                  <Select.Root
                    collection={statusCollection}
                    value={selectedStatus ? [selectedStatus] : []}
                    onValueChange={(details) => setSelectedStatus(details.value[0] || "")}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText placeholder="All statuses" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content minWidth="300px">
                        {statusCollection.items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Box>
              </HStack>
            </VStack>

            {/* Export Actions */}
            <HStack gap={4} justify="flex-end">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isExporting}
              >
                <FiFilter />
                Reset Filters
              </Button>
              <Button
                colorPalette="blue"
                onClick={handleExport}
                loading={isExporting}
                disabled={!canExport}
              >
                <FiDownload />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  )
}

export default CSVExportInterface
