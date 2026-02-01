import { Checkbox } from "@/components/ui/checkbox"
import { formatDateTimeInLocationTz } from "@/utils"
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
  type MissionPublic,
  MissionsService,
  type TripPublic,
  TripsService,
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

// Available CSV fields
const CSV_FIELDS = [
  { key: "confirmation_code", label: "Confirmation Code" },
  { key: "customer_name", label: "Customer Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "billing_address", label: "Billing Address" },
  { key: "status", label: "Status" },
  { key: "total_amount", label: "Total Amount" },
  { key: "subtotal", label: "Subtotal" },
  { key: "discount_amount", label: "Discount Amount" },
  { key: "tax_amount", label: "Tax Amount" },
  { key: "tip_amount", label: "Tip Amount" },
  { key: "created_at", label: "Created At" },
  { key: "trip_type", label: "Trip Type" },
  { key: "boat_name", label: "Boat Name" },
  { key: "ticket_types_quantity", label: "Ticket Types – Quantity" },
  { key: "ticket_types_price", label: "Ticket Types – Price" },
  { key: "ticket_types_total", label: "Ticket Types – Total" },
  { key: "swag_description", label: "Swag – Description" },
  { key: "swag_total", label: "Swag – Total" },
]

const AMOUNT_FIELD_KEYS = [
  "total_amount",
  "subtotal",
  "discount_amount",
  "tax_amount",
  "tip_amount",
  "ticket_types_price",
  "ticket_types_total",
  "swag_total",
]

const CSVExportInterface = () => {
  const [selectedMissionId, setSelectedMissionId] = useState("")
  const [selectedTripId, setSelectedTripId] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(CSV_FIELDS.map((f) => f.key)), // All fields selected by default
  )
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
      label: `${trip.type} - ${formatDateTimeInLocationTz(
        trip.departure_time,
        trip.timezone,
      )}`,
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

      // Convert selected fields set to comma-separated string
      const fieldsParam =
        selectedFields.size > 0
          ? Array.from(selectedFields).join(",")
          : undefined

      // Make the API call
      const response = await BookingsService.exportBookingsCsv({
        missionId: selectedMissionId || undefined,
        tripId: selectedTripId || undefined,
        bookingStatus: selectedStatus || undefined,
        fields: fieldsParam,
      })

      // Create download link
      const blob = new Blob([response as BlobPart], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // Generate filename based on filters
      let filename = "bookings_export"
      if (selectedMissionId) {
        const mission = missions.find(
          (m: MissionPublic) => m.id === selectedMissionId,
        )
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
    setSelectedFields(new Set(CSV_FIELDS.map((f) => f.key))) // Reset to all fields
  }

  const toggleField = (fieldKey: string) => {
    const newSelected = new Set(selectedFields)
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey)
    } else {
      newSelected.add(fieldKey)
    }
    setSelectedFields(newSelected)
  }

  const selectAllFields = () => {
    setSelectedFields(new Set(CSV_FIELDS.map((f) => f.key)))
  }

  const deselectAllFields = () => {
    setSelectedFields(new Set())
  }

  const deselectAmountFields = () => {
    const next = new Set(selectedFields)
    AMOUNT_FIELD_KEYS.forEach((k) => next.delete(k))
    setSelectedFields(next)
  }

  const selectAmountFields = () => {
    const next = new Set(selectedFields)
    AMOUNT_FIELD_KEYS.forEach((k) => next.add(k))
    setSelectedFields(next)
  }

  // Check if ticket-type fields are selected
  const hasTicketTypeFields =
    selectedFields.has("ticket_types_quantity") ||
    selectedFields.has("ticket_types_price") ||
    selectedFields.has("ticket_types_total")

  // Trip is required when ticket-type fields are selected
  const tripRequired = hasTicketTypeFields
  const canExport = !isExporting && (!tripRequired || selectedTripId)

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">CSV Export</Heading>

      <Card.Root bg="bg.panel">
        <Card.Body>
          <VStack gap={6} align="stretch">
            <Heading size="md">Export Passenger Manifest</Heading>
            <Text color="text.muted">
              Export booking data to CSV format with optional filtering by
              mission, trip, or status.
              {hasTicketTypeFields && (
                <Text as="span" display="block" mt={1} color="orange.600">
                  Note: Trip selection is required when exporting ticket-type
                  columns to ensure accurate column headers.
                </Text>
              )}
            </Text>

            {/* Field Selection */}
            <VStack gap={4} align="stretch">
              <Heading size="sm">Select Fields to Export</Heading>
              <HStack gap={2} justify="flex-end" flexWrap="wrap">
                <Button variant="ghost" size="sm" onClick={selectAllFields}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllFields}>
                  Deselect All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAmountFields}
                >
                  Deselect amount columns
                </Button>
                <Button variant="ghost" size="sm" onClick={selectAmountFields}>
                  Select amount columns
                </Button>
              </HStack>
              <Box
                display="grid"
                gridTemplateColumns="repeat(auto-fill, minmax(250px, 1fr))"
                gap={3}
              >
                {CSV_FIELDS.map((field) => (
                  <Checkbox
                    key={field.key}
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  >
                    {field.label}
                  </Checkbox>
                ))}
              </Box>
            </VStack>

            {/* Filters */}
            <VStack gap={4} align="stretch">
              <Heading size="sm">Filters</Heading>
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
                    Trip{" "}
                    {tripRequired && (
                      <Text as="span" color="red.500">
                        *
                      </Text>
                    )}
                    {tripRequired ? " (Required)" : " (Optional)"}
                  </Text>
                  {tripRequired && !selectedTripId && (
                    <Text fontSize="sm" color="orange.600" mb={1}>
                      Trip selection is required when exporting ticket-type
                      columns
                    </Text>
                  )}
                  <Select.Root
                    collection={tripsCollection}
                    value={selectedTripId ? [selectedTripId] : []}
                    onValueChange={(details) =>
                      setSelectedTripId(details.value[0] || "")
                    }
                    disabled={!selectedMissionId}
                  >
                    <Select.Control width="100%">
                      <Select.Trigger>
                        <Select.ValueText
                          placeholder={
                            selectedMissionId
                              ? tripRequired
                                ? "Select a trip"
                                : "All trips"
                              : "Select mission first"
                          }
                        />
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
                    onValueChange={(details) =>
                      setSelectedStatus(details.value[0] || "")
                    }
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
