import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  IconButton,
  Input,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react"
import { NativeSelect } from "@/components/ui/native-select"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useEffect, useRef, useState } from "react"
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi"

import {
  type ApiError,
  BoatsService,
  TripBoatsService,
  type TripPublic,
  type TripUpdate,
  TripsService,
} from "@/client"
import { MissionDropdown } from "@/components/Common/MissionDropdown"
import {
  DialogActionTrigger,
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
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import TripPricingManager from "./TripPricingManager"

interface EditTripProps {
  trip: TripPublic
}

const EditTrip = ({ trip }: EditTripProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [missionId, setMissionId] = useState(trip.mission_id)
  const [type, setType] = useState(trip.type)
  const [active, setActive] = useState(trip.active ?? true)

  // Check if trip is in the past
  const isPast = new Date(trip.departure_time) < new Date()
  const [checkInTime, setCheckInTime] = useState(
    format(new Date(trip.check_in_time), "yyyy-MM-dd'T'HH:mm"),
  )
  const [boardingTime, setBoardingTime] = useState(
    format(new Date(trip.boarding_time), "yyyy-MM-dd'T'HH:mm"),
  )
  const [departureTime, setDepartureTime] = useState(
    format(new Date(trip.departure_time), "yyyy-MM-dd'T'HH:mm"),
  )
  const [boatsData, setBoatsData] = useState<any[]>([])
  const [tripBoats, setTripBoats] = useState<any[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState("")
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined)
  const [isAddingBoat, setIsAddingBoat] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)

  const mutation = useMutation({
    mutationFn: (data: TripUpdate) =>
      TripsService.updateTrip({
        tripId: trip.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Trip updated successfully.")
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    },
  })

  // Fetch boats
  const { data: allBoats } = useQuery({
    queryKey: ["boats-for-edit-trip"],
    queryFn: () => BoatsService.readBoats({ limit: 100 }),
    enabled: isOpen,
  })

  // Fetch trip boats
  const { data: tripBoatsData, refetch: refetchTripBoats } = useQuery({
    queryKey: ["trip-boats-for-edit", trip.id],
    queryFn: async () => {
      const response = await TripBoatsService.readTripBoatsByTrip({
        tripId: trip.id,
      })
      return response
    },
    enabled: isOpen,
  })

  // Update boats data when fetched
  useEffect(() => {
    if (allBoats?.data) {
      setBoatsData(allBoats.data)
    }
  }, [allBoats])

  // Update trip boats when fetched
  useEffect(() => {
    if (tripBoatsData) {
      setTripBoats(Array.isArray(tripBoatsData) ? (tripBoatsData as any[]) : [])
    }
  }, [tripBoatsData])

  // Create a map of boat ids to boat objects for quick lookup
  const boatsMap = new Map<string, any>()
  if (boatsData) {
    boatsData.forEach((boat) => {
      boatsMap.set(boat.id, boat)
    })
  }

  // Handle adding a boat
  const handleAddBoat = async () => {
    if (!selectedBoatId) return

    try {
      // Check if this boat is already associated with this trip
      const exists = tripBoats.some((tb) => tb.boat_id === selectedBoatId)
      if (exists) {
        showSuccessToast("This boat is already associated with this trip")
        return
      }

      await TripBoatsService.createTripBoat({
        requestBody: {
          trip_id: trip.id,
          boat_id: selectedBoatId,
          max_capacity: maxCapacity || null,
        },
      })

      showSuccessToast("The boat has been successfully added to this trip")

      // Reset form and refresh data
      setSelectedBoatId("")
      setMaxCapacity(undefined)
      setIsAddingBoat(false)
      refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
    } catch (error) {
      console.error("Error adding boat to trip:", error)
      handleError(error as ApiError)
    }
  }

  // Handle removing a boat
  const handleRemoveBoat = async (tripBoatId: string) => {
    try {
      await TripBoatsService.deleteTripBoat({
        tripBoatId,
      })

      showSuccessToast("The boat has been removed from this trip")

      // Refresh data
      refetchTripBoats()
      queryClient.invalidateQueries({ queryKey: ["trip-boats"] })
    } catch (error) {
      console.error("Error removing boat from trip:", error)
      handleError(error as ApiError)
    }
  }

  const handleSubmit = () => {
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
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={isPast}
          title={isPast ? "This trip has already departed and cannot be edited" : ""}
        >
          <FiEdit fontSize="16px" />
          Edit Trip
        </Button>
      </DialogTrigger>

      <DialogContent ref={contentRef}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            <DialogCloseTrigger />
            <DialogHeader>
              <DialogTitle>Edit Trip</DialogTitle>
            </DialogHeader>
            <DialogBody>
              {isPast && (
                <Text mb={4} color="orange.500">
                  This trip has already departed and cannot be edited. Contact a system administrator if you need to make changes to past trips.
                </Text>
              )}
              <Tabs.Root defaultValue="basic-info" variant="subtle">
                <Tabs.List>
                  <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
                  <Tabs.Trigger value="boats">Boats</Tabs.Trigger>
                  <Tabs.Trigger value="pricing">
                    Pricing & Merchandise
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="basic-info">
                  <VStack gap={4}>
                    <Field label="Mission" required>
                      <MissionDropdown
                        id="mission_id"
                        value={missionId}
                        onChange={setMissionId}
                        isDisabled={mutation.isPending || isPast}
                        portalRef={contentRef}
                      />
                    </Field>

                    <Field label="Type" required>
                      <NativeSelect
                        id="type"
                        value={type}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setType(e.target.value)
                        }
                        disabled={mutation.isPending || isPast}
                      >
                        <option value="launch_viewing">Launch Viewing</option>
                        <option value="pre_launch">Pre-Launch</option>
                      </NativeSelect>
                    </Field>

                    <Field label="Check-in Time" required>
                      <Input
                        id="check_in_time"
                        type="datetime-local"
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        disabled={mutation.isPending || isPast}
                      />
                    </Field>

                    <Field label="Boarding Time" required>
                      <Input
                        id="boarding_time"
                        type="datetime-local"
                        value={boardingTime}
                        onChange={(e) => setBoardingTime(e.target.value)}
                        disabled={mutation.isPending || isPast}
                      />
                    </Field>

                    <Field label="Departure Time" required>
                      <Input
                        id="departure_time"
                        type="datetime-local"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        disabled={mutation.isPending || isPast}
                      />
                    </Field>

                    <Field>
                      <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        <Text>Active</Text>
                      <Box
                        onClick={() => {
                          if (!isPast) setActive(!active)
                        }}
                        cursor={isPast ? "not-allowed" : "pointer"}
                        opacity={isPast ? 0.5 : 1}
                      >
                          <Switch
                            checked={active}
                            disabled={mutation.isPending || isPast}
                            inputProps={{ id: "active" }}
                          />
                        </Box>
                      </Flex>
                    </Field>
                  </VStack>
                </Tabs.Content>

                {/* Boats Tab */}
                <Tabs.Content value="boats">
                  <Box width="100%">
                    <Text fontWeight="bold" mb={2}>
                      Associated Boats
                    </Text>

                    {/* List of current boats */}
                    {tripBoats && tripBoats.length > 0 ? (
                      <VStack align="stretch" mb={4} gap={2}>
                        {tripBoats.map((tripBoat) => {
                          const boat = boatsMap.get(tripBoat.boat_id)
                          return (
                            <Flex
                              key={tripBoat.id}
                              justify="space-between"
                              align="center"
                              p={2}
                              borderWidth="1px"
                              borderRadius="md"
                            >
                              <Text>
                                {boat?.name || "Unknown"} (Capacity:{" "}
                                {tripBoat.max_capacity ||
                                  boat?.capacity ||
                                  "Unknown"}
                                )
                              </Text>
                              <IconButton
                                aria-label="Remove boat"
                                children={<FiTrash2 />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleRemoveBoat(tripBoat.id)}
                              />
                            </Flex>
                          )
                        })}
                      </VStack>
                    ) : (
                      <Text mb={4}>No boats assigned to this trip yet.</Text>
                    )}

                    {/* Add boat form */}
                    {isAddingBoat ? (
                      <VStack
                        align="stretch"
                        gap={3}
                        mb={4}
                        p={3}
                        borderWidth="1px"
                        borderRadius="md"
                      >
                        <Field label="Select Boat" required>
                          <NativeSelect
                            value={selectedBoatId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              setSelectedBoatId(e.target.value)
                            }
                            disabled={mutation.isPending || isPast}
                          >
                            <option value="">Select a boat</option>
                            {boatsData.map((boat) => (
                              <option key={boat.id} value={boat.id}>
                                {boat.name} (Capacity: {boat.capacity})
                              </option>
                            ))}
                          </NativeSelect>
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

                        <Flex justify="flex-end" gap={2}>
                          <Button
                            size="sm"
                            onClick={() => setIsAddingBoat(false)}
                          >
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
                        <FiPlus style={{ marginRight: "4px" }} />
                        Add Boat
                      </Button>
                    )}
                  </Box>
                </Tabs.Content>

                {/* Pricing & Merchandise Tab */}
                <Tabs.Content value="pricing">
                  <TripPricingManager tripId={trip.id} />
                </Tabs.Content>
              </Tabs.Root>
            </DialogBody>

            <DialogFooter gap={2}>
              <ButtonGroup>
                <DialogActionTrigger asChild>
                  <Button
                    variant="subtle"
                    colorPalette="gray"
                    disabled={mutation.isPending}
                  >
                    Cancel
                  </Button>
                </DialogActionTrigger>
                <Button
                  variant="solid"
                  type="submit"
                  loading={mutation.isPending}
                  disabled={
                    isPast ||
                    !missionId ||
                    !checkInTime ||
                    !boardingTime ||
                    !departureTime ||
                    mutation.isPending
                  }
                >
                  Update
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
    </DialogRoot>
  )
}

export default EditTrip
