import { VStack } from "@chakra-ui/react"

import type { TripBoatPublicWithAvailability } from "@/client"
import type { TripPublic } from "@/client"
import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import { parseApiDate } from "@/utils"
import { formatTripOptionLabel } from "./types"

interface AddBookingTripSectionProps {
  selectedTripId: string
  trips: TripPublic[] | undefined
  tripBoats: TripBoatPublicWithAvailability[]
  boatNames: Record<string, string>
  selectedBoatId: string
  onTripChange: (tripId: string) => void
  onBoatChange: (boatId: string) => void
}

export function AddBookingTripSection({
  selectedTripId,
  trips,
  tripBoats,
  boatNames,
  selectedBoatId,
  onTripChange,
  onBoatChange,
}: AddBookingTripSectionProps) {
  const futureTrips =
    trips?.filter((trip) => {
      if (!trip.departure_time) return false
      const departureTime = parseApiDate(trip.departure_time)
      return departureTime >= new Date()
    }) ?? []

  return (
    <VStack gap={4} width="100%" align="stretch">
      <Field label="Select Trip" required>
        <NativeSelect
          value={selectedTripId}
          onChange={(e) => onTripChange(e.target.value)}
        >
          <option value="">Select a trip...</option>
          {futureTrips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {formatTripOptionLabel(trip)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {selectedTripId && tripBoats.length > 0 && (
        <Field label="Assign Boat" required>
          <NativeSelect
            value={selectedBoatId}
            onChange={(e) => onBoatChange(e.target.value)}
          >
            {tripBoats.map((tb, idx) => (
              <option key={`${tb.boat_id}-${idx}`} value={tb.boat_id}>
                {`${boatNames[tb.boat_id] || tb.boat?.name || tb.boat_id} (${tb.remaining_capacity} spots left)`}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    </VStack>
  )
}
