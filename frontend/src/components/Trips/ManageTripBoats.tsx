import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import {
  Button,
  Flex,
  Input,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { FiAnchor, FiTrash2 } from "react-icons/fi"

import { BoatsService, TripBoatsService, type TripPublic } from "@/client"
import { toaster } from "@/components/ui/toaster"

interface ManageTripBoatsProps {
  trip: TripPublic
}

interface TripBoat {
  id: string
  trip_id: string
  boat_id: string
  max_capacity?: number | null
}

interface Boat {
  id: string
  name: string
  capacity: number
}

const ManageTripBoats = ({ trip }: ManageTripBoatsProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  // Get all available boats
  const { data: boatsData } = useQuery({
    queryKey: ["boats-for-trips"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  // Get trip boats - handle the response as unknown and use a type assertion
  const { data, refetch: refetchTripBoats } = useQuery({
    queryKey: ["trip-boats", trip.id],
    queryFn: async () => {
      const response = await TripBoatsService.readTripBoatsByTrip({
        tripId: trip.id,
      })
      return response as unknown as TripBoat[]
    },
    enabled: isOpen,
  })

  // Safely access the trip boats data
  const tripBoatsData: TripBoat[] = data || []

  // Map to quickly access boat details
  const boatsMap = new Map<string, Boat>()
  if (boatsData?.data) {
    boatsData.data.forEach((boat: any) => {
      boatsMap.set(boat.id, boat)
    })
  }

  const handleAddBoat = async () => {
    if (!selectedBoatId) return

    setIsSubmitting(true)
    try {
      // Check if this boat is already associated with this trip
      const exists = tripBoatsData.some((tb) => tb.boat_id === selectedBoatId)
      if (exists) {
        toaster.create({
          title: "Warning",
          description: "This boat is already associated with this trip",
          type: "warning",
        })
        setIsSubmitting(false)
        return
      }

      await TripBoatsService.createTripBoat({
        requestBody: {
          trip_id: trip.id,
          boat_id: selectedBoatId,
          max_capacity: maxCapacity || null,
        },
      })

      toaster.create({
        title: "Success!",
        description: "The boat has been successfully added to this trip",
        type: "success",
      })

      // Reset form
      setSelectedBoatId("")
      setMaxCapacity(undefined)

      // Refetch trip-boats data and invalidate trip-related queries
      refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    } catch (error) {
      console.error("Error adding boat to trip:", error)
      toaster.create({
        title: "Error",
        description: "Failed to add boat to trip. Please try again.",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveBoat = async (tripBoatId: string) => {
    try {
      await TripBoatsService.deleteTripBoat({
        tripBoatId,
      })

      toaster.create({
        title: "Success!",
        description: "The boat has been removed from this trip",
        type: "success",
      })

      // Refetch and invalidate queries
      refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    } catch (error) {
      console.error("Error removing boat from trip:", error)
      toaster.create({
        title: "Error",
        description: "Failed to remove boat from trip. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">
          <FiAnchor fontSize="16px" />
          Manage Boats
        </Button>
      </DialogTrigger>

      <DialogContent>
          <DialogCloseTrigger />
          <DialogHeader>
            <DialogTitle>Manage Boats for Trip</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Manage the boats associated with this trip.</Text>
            <VStack gap={4}>
              {/* Current boats associated with this trip */}
              <Flex direction="column" width="100%">
                <Text fontWeight="bold" mb={2}>
                  Current Boats ({tripBoatsData.length || 0})
                </Text>
                {tripBoatsData.length > 0 ? (
                  <Table.Root size={{ base: "sm" }} variant="outline">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Boat Name</Table.ColumnHeader>
                        <Table.ColumnHeader>
                          Standard Capacity
                        </Table.ColumnHeader>
                        <Table.ColumnHeader>Custom Capacity</Table.ColumnHeader>
                        <Table.ColumnHeader>Actions</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {tripBoatsData.map((tripBoat) => {
                        const boat = boatsMap.get(tripBoat.boat_id)
                        return (
                          <Table.Row key={tripBoat.id}>
                            <Table.Cell>{boat?.name || "Unknown"}</Table.Cell>
                            <Table.Cell>
                              {boat?.capacity || "Unknown"}
                            </Table.Cell>
                            <Table.Cell>
                              {tripBoat.max_capacity || "Default"}
                            </Table.Cell>
                            <Table.Cell>
                              <Button
                                aria-label="Remove boat"
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleRemoveBoat(tripBoat.id)}
                              >
                                <FiTrash2 />
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                ) : (
                  <Text>No boats assigned to this trip yet.</Text>
                )}
              </Flex>

              {/* Add new boat */}
              <Flex direction="column" width="100%" mt={4}>
                <Text fontWeight="bold" mb={2}>
                  Add New Boat
                </Text>
                <VStack align="stretch" gap={4}>
                  <Field label="Select Boat" required>
                    <select
                      id="boat_id"
                      value={selectedBoatId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setSelectedBoatId(e.target.value)
                      }
                      disabled={isSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "0.375rem",
                        border: "1px solid",
                        borderColor: "inherit",
                      }}
                    >
                      <option value="">Select a boat</option>
                      {boatsData?.data?.map((boat: any) => (
                        <option key={boat.id} value={boat.id}>
                          {boat.name} (Capacity: {boat.capacity})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Custom Max Capacity (Optional)">
                    <Input
                      type="number"
                      value={maxCapacity || ""}
                      onChange={(e) =>
                        setMaxCapacity(
                          e.target.value
                            ? Number.parseInt(e.target.value)
                            : undefined,
                        )
                      }
                      min={1}
                    />
                  </Field>

                  <Button
                    colorScheme="blue"
                    onClick={handleAddBoat}
                    disabled={!selectedBoatId || isSubmitting}
                    loading={isSubmitting}
                  >
                    Add Boat to Trip
                  </Button>
                </VStack>
              </Flex>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
    </DialogRoot>
  )
}

export default ManageTripBoats
