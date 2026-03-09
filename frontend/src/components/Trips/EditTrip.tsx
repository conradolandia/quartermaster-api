import {
  Button,
  ButtonGroup,
  Tabs,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { FiEdit } from "react-icons/fi"

import {
  type ApiError,
  type TripPublic,
  type TripUpdate,
  TripsService,
} from "@/client"
import BasicInfoTab from "@/components/Trips/BasicInfoTab"
import BoatsTab from "@/components/Trips/BoatsTab"
import { MerchandiseTab } from "@/components/Trips/MerchandiseTab"
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
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatInLocationTimezone,
  handleError,
  parseApiDate,
  parseLocationTimeToUtc,
} from "@/utils"
type EditTripTab = "basic-info" | "boats" | "pricing"

interface EditTripProps {
  trip: TripPublic
  /** When set, dialog opens on this tab (e.g. "boats" for Manage Boats). */
  initialTab?: EditTripTab
  /** When set, trigger button shows this label instead of "Edit Trip". */
  triggerLabel?: string
  /** When provided, dialog open state is controlled (e.g. open after duplicate). */
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

const EditTrip = ({
  trip,
  initialTab = "basic-info",
  triggerLabel = "Edit Trip",
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  disabled = false,
}: EditTripProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange != null
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen
  const [missionId, setMissionId] = useState(trip.mission_id)
  const [name, setName] = useState(trip.name ?? "")
  const [type, setType] = useState(trip.type)
  const [active, setActive] = useState(trip.active ?? true)
  const [unlisted, setUnlisted] = useState(trip.unlisted ?? false)
  const [bookingMode, setBookingMode] = useState(
    trip.booking_mode ?? "private",
  )

  const tz = trip.timezone ?? "UTC"
  const dep = parseApiDate(trip.departure_time)
  const board = parseApiDate(trip.boarding_time)
  const checkIn = parseApiDate(trip.check_in_time)
  const [departureTime, setDepartureTime] = useState(
    formatInLocationTimezone(dep, tz),
  )
  const [salesOpenAt, setSalesOpenAt] = useState(
    (trip as { sales_open_at?: string | null }).sales_open_at
      ? formatInLocationTimezone(
          parseApiDate(
            (trip as { sales_open_at?: string | null }).sales_open_at!,
          ),
          tz,
        )
      : "",
  )
  const [boardingMinutesBeforeDeparture, setBoardingMinutesBeforeDeparture] =
    useState(() =>
      String(Math.round((dep.getTime() - board.getTime()) / (60 * 1000))),
    )
  const [checkinMinutesBeforeBoarding, setCheckinMinutesBeforeBoarding] =
    useState(() =>
      String(Math.round((board.getTime() - checkIn.getTime()) / (60 * 1000))),
    )
  const [hasPendingMerchandiseChanges, setHasPendingMerchandiseChanges] =
    useState(false)
  const [hasPendingBoatsChanges, setHasPendingBoatsChanges] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const contentRef = useRef(null)

  const hasPendingTabChanges =
    hasPendingBoatsChanges || hasPendingMerchandiseChanges

  const mutation = useMutation({
    mutationFn: (data: TripUpdate) =>
      TripsService.updateTrip({
        tripId: trip.id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("Trip updated successfully.")
      setOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    },
  })

  // Sync inputs when dialog opens or trip changes (e.g. after duplicate).
  // Only depend on isOpen and trip.id so we do not overwrite user edits when
  // a refetch (e.g. after save) updates the trip prop.
  useEffect(() => {
    if (isOpen) {
      const zone = trip.timezone ?? "UTC"
      setMissionId(trip.mission_id)
      setName(trip.name ?? "")
      setType(trip.type)
      setActive(trip.active ?? true)
      setUnlisted(trip.unlisted ?? false)
      setBookingMode(trip.booking_mode ?? "private")
      setDepartureTime(
        formatInLocationTimezone(parseApiDate(trip.departure_time), zone),
      )
      const salesOpen = (trip as { sales_open_at?: string | null }).sales_open_at
      setSalesOpenAt(
        salesOpen
          ? formatInLocationTimezone(parseApiDate(salesOpen), zone)
          : "",
      )
      const d = parseApiDate(trip.departure_time)
      const b = parseApiDate(trip.boarding_time)
      const c = parseApiDate(trip.check_in_time)
      setBoardingMinutesBeforeDeparture(
        String(Math.round((d.getTime() - b.getTime()) / (60 * 1000))),
      )
      setCheckinMinutesBeforeBoarding(
        String(Math.round((b.getTime() - c.getTime()) / (60 * 1000))),
      )
    }
  }, [isOpen, trip.id])

  const handleSubmit = () => {
    if (!missionId || !departureTime) return
    const boardingMins = parseInt(boardingMinutesBeforeDeparture, 10) || 0
    const checkinMins = parseInt(checkinMinutesBeforeBoarding, 10) || 0
    if (boardingMins < 0 || checkinMins < 0) return

    mutation.mutate({
      mission_id: missionId,
      name: name || null,
      type: type,
      active: active,
      unlisted: unlisted,
      booking_mode: bookingMode,
      sales_open_at: salesOpenAt
        ? parseLocationTimeToUtc(salesOpenAt, tz)
        : null,
      departure_time: parseLocationTimeToUtc(departureTime, tz),
      boarding_minutes_before_departure: boardingMins,
      checkin_minutes_before_boarding: checkinMins,
    })
  }

  return (
    <>
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        open={isOpen}
        onOpenChange={({ open }) => setOpen(open)}
      >
        {!isControlled && (
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              color="dark.accent.primary"
              disabled={disabled}
            >
              <FiEdit fontSize="16px" />
              {triggerLabel}
            </Button>
          </DialogTrigger>
        )}

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
              <Tabs.Root defaultValue={initialTab} variant="subtle">
                <Tabs.List>
                  <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
                  <Tabs.Trigger value="boats">Boats</Tabs.Trigger>
                  <Tabs.Trigger value="pricing">Merchandise</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="basic-info">
                  <BasicInfoTab
                    missionId={missionId}
                    setMissionId={setMissionId}
                    name={name}
                    setName={setName}
                    type={type}
                    setType={setType}
                    bookingMode={bookingMode}
                    setBookingMode={setBookingMode}
                    salesOpenAt={salesOpenAt}
                    setSalesOpenAt={setSalesOpenAt}
                    departureTime={departureTime}
                    setDepartureTime={setDepartureTime}
                    boardingMinutesBeforeDeparture={boardingMinutesBeforeDeparture}
                    setBoardingMinutesBeforeDeparture={setBoardingMinutesBeforeDeparture}
                    checkinMinutesBeforeBoarding={checkinMinutesBeforeBoarding}
                    setCheckinMinutesBeforeBoarding={setCheckinMinutesBeforeBoarding}
                    active={active}
                    setActive={setActive}
                    unlisted={unlisted}
                    setUnlisted={setUnlisted}
                    tz={tz}
                    isPending={mutation.isPending}
                    contentRef={contentRef}
                  />
                </Tabs.Content>

                <Tabs.Content value="boats">
                  <BoatsTab
                    tripId={trip.id}
                    isOpen={isOpen}
                    onPendingChange={setHasPendingBoatsChanges}
                  />
                </Tabs.Content>

                <Tabs.Content value="pricing">
                  <MerchandiseTab
                    tripId={trip.id}
                    isOpen={isOpen}
                    onPendingChange={setHasPendingMerchandiseChanges}
                  />
                </Tabs.Content>
              </Tabs.Root>
            </DialogBody>

            <DialogFooter gap={2} justifyContent="flex-end">
              {hasPendingTabChanges && (
                <Text fontSize="xs" color="gray.500" flex={1}>
                  Save or cancel pending changes in Boats or Merchandise tab
                  before updating.
                </Text>
              )}
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
                    !missionId ||
                    !departureTime ||
                    mutation.isPending ||
                    hasPendingTabChanges
                  }
                  title={
                    hasPendingTabChanges
                      ? "Save or cancel pending changes in Boats or Merchandise tab first"
                      : undefined
                  }
                >
                  Update
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>

    </>
  )
}

export default EditTrip
