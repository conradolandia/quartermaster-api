import { useRef, useState, useEffect } from "react"
import { Button, Input, VStack, Portal, Flex, Text, Box, IconButton } from "@chakra-ui/react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { FiPlus, FiTrash2 } from "react-icons/fi"

import { TripsService, BoatsService } from "@/client"
import { Switch } from "../ui/switch"

import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../ui/dialog"

import { Field } from "../ui/field"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { MissionDropdown } from "../Common/MissionDropdown"

// Props interface
interface AddTripProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Interface for boat selection
interface SelectedBoat {
  boat_id: string
  max_capacity?: number | null
  name?: string
  capacity?: number
}

const AddTrip = ({ isOpen, onClose, onSuccess }: AddTripProps) => {
  const [missionId, setMissionId] = useState("")
  const [type, setType] = useState("launch_viewing")
  const [active, setActive] = useState(true)
  const [checkInTime, setCheckInTime] = useState("")
  const [boardingTime, setBoardingTime] = useState("")
  const [departureTime, setDepartureTime] = useState("")
  const { showSuccessToast } = useCustomToast()
  const queryClient = useQueryClient()
  const contentRef = useRef(null)

  // Boat management
  const [boatsData, setBoatsData] = useState<any[]>([])
  const [selectedBoats, setSelectedBoats] = useState<SelectedBoat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isAddingBoat, setIsAddingBoat] = useState(false)

  // Fetch all boats
  const { data: allBoats } = useQuery({
    queryKey: ["boats-for-add-trip"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  // Update boats data when fetched
  useEffect(() => {
    if (allBoats?.data) {
      setBoatsData(allBoats.data)
    }
  }, [allBoats])

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedBoats([])
      setSelectedBoatId("")
      setMaxCapacity(undefined)
      setIsAddingBoat(false)
    }
  }, [isOpen])

  // Handle adding a boat to the selection
  const handleAddBoat = () => {
    if (!selectedBoatId) return

    // Check if this boat is already in the selection
    const exists = selectedBoats.some(boat => boat.boat_id === selectedBoatId)
    if (exists) {
      showSuccessToast("This boat is already added to the selection")
      return
    }

    // Find the boat details
    const boatDetails = boatsData.find(boat => boat.id === selectedBoatId)

    // Add to selected boats
    setSelectedBoats([
      ...selectedBoats,
      {
        boat_id: selectedBoatId,
        max_capacity: maxCapacity || null,
        name: boatDetails?.name,
        capacity: boatDetails?.capacity
      }
    ])

    // Reset form
    setSelectedBoatId("")
    setMaxCapacity(undefined)
    setIsAddingBoat(false)
  }

  // Handle removing a boat from the selection
  const handleRemoveBoat = (boatId: string) => {
    setSelectedBoats(selectedBoats.filter(boat => boat.boat_id !== boatId))
  }

  // Use mutation for creating trip
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the trip
      const tripResponse = await TripsService.createTrip({
        requestBody: data
      })

      // If we have selected boats and trip creation was successful
      if (selectedBoats.length > 0 && tripResponse.id) {
        // Create trip-boat associations
        const tripBoatPromises = selectedBoats.map(boat =>
          fetch(`/api/trip-boats`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trip_id: tripResponse.id,
              boat_id: boat.boat_id,
              max_capacity: boat.max_capacity
            })
          })
        )

        // Wait for all boat associations to be created
        await Promise.all(tripBoatPromises)
      }

      return tripResponse
    },
    onSuccess: () => {
      showSuccessToast("Trip was successfully added")
      setMissionId("")
      setType("launch_viewing")
      setActive(true)
      setCheckInTime("")
      setBoardingTime("")
      setDepartureTime("")
      setSelectedBoats([])
      queryClient.invalidateQueries({ queryKey: ["trips"] })
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      handleError(error)
    },
  })

  const handleSubmit = async () => {
    if (!missionId || !checkInTime || !boardingTime || !departureTime) return

    mutation.mutate({
      mission_id: missionId,
      type: type,
      active: active,
      check_in_time: new Date(checkInTime).toISOString(),
      boarding_time: new Date(boardingTime).toISOString(),
      departure_time: new Date(departureTime).toISOString(),
    })
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <DialogContent ref={contentRef}>
          <DialogHeader>
            <DialogTitle>Add Trip</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4}>
              <Field label="Mission" required>
                <MissionDropdown
                  id="mission_id"
                  value={missionId}
                  onChange={setMissionId}
                  isDisabled={mutation.isPending}
                  portalRef={contentRef}
                />
              </Field>
              <Field label="Type" required>
                <select
                  id="type"
                  value={type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid',
                    borderColor: 'inherit'
                  }}
                >
                  <option value="launch_viewing">Launch Viewing</option>
                  <option value="pre_launch">Pre-Launch</option>
                </select>
              </Field>
              <Field label="Check-in Time" required>
                <Input
                  id="check_in_time"
                  type="datetime-local"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  placeholder="Check-in time"
                />
              </Field>
              <Field label="Boarding Time" required>
                <Input
                  id="boarding_time"
                  type="datetime-local"
                  value={boardingTime}
                  onChange={(e) => setBoardingTime(e.target.value)}
                  placeholder="Boarding time"
                />
              </Field>
              <Field label="Departure Time" required>
                <Input
                  id="departure_time"
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  placeholder="Departure time"
                />
              </Field>
              <Field>
                <Flex alignItems="center" justifyContent="space-between" width="100%">
                  <Text>Active</Text>
                  <Switch
                    id="active"
                    isChecked={active}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActive(e.target.checked)}
                  />
                </Flex>
              </Field>

              {/* Boats section */}
              <hr className="my-4 border-t border-gray-200" />
              <Box width="100%">
                <Text fontWeight="bold" mb={2}>Add Boats</Text>

                {/* List of selected boats */}
                {selectedBoats.length > 0 ? (
                  <VStack align="stretch" mb={4} gap={2}>
                    {selectedBoats.map((boat, index) => (
                      <Flex key={index} justify="space-between" align="center" p={2} borderWidth="1px" borderRadius="md">
                        <Text>{boat.name || "Unknown"} (Capacity: {boat.max_capacity || boat.capacity || "Unknown"})</Text>
                        <IconButton
                          aria-label="Remove boat"
                          children={<FiTrash2 />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleRemoveBoat(boat.boat_id)}
                        />
                      </Flex>
                    ))}
                  </VStack>
                ) : (
                  <Text mb={4}>No boats selected yet.</Text>
                )}

                {/* Add boat form */}
                {isAddingBoat ? (
                  <VStack align="stretch" gap={3} mb={4} p={3} borderWidth="1px" borderRadius="md">
                    <Field label="Select Boat" required>
                      <select
                        value={selectedBoatId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBoatId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid',
                          borderColor: 'inherit'
                        }}
                      >
                        <option value="">Select a boat</option>
                        {boatsData.map((boat) => (
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
                        onChange={(e) => setMaxCapacity(e.target.value ? parseInt(e.target.value) : undefined)}
                        min={1}
                      />
                    </Field>

                    <Flex justify="flex-end" gap={2}>
                      <Button size="sm" onClick={() => setIsAddingBoat(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={handleAddBoat}
                        disabled={!selectedBoatId}
                      >
                        Add Boat
                      </Button>
                    </Flex>
                  </VStack>
                ) : (
                  <Button
                    onClick={() => setIsAddingBoat(true)}
                    size="sm"
                    mb={4}
                  >
                    <FiPlus style={{ marginRight: '4px' }} />
                    Add Boat
                  </Button>
                )}
              </Box>
            </VStack>
          </DialogBody>
          <DialogFooter gap={2}>
            <Button
              variant="subtle"
              colorPalette="gray"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleSubmit}
              loading={mutation.isPending}
              disabled={!missionId || !checkInTime || !boardingTime || !departureTime || mutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </Portal>
    </DialogRoot>
  )
}

export default AddTrip
