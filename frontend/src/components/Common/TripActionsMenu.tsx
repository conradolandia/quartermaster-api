import { MissionsService, TripsService, type TripPublic } from "../../client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCopy, FiLink, FiMail } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { getPublicOrigin } from "@/utils/url"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteTrip from "../Trips/DeleteTrip"
import EditTrip from "../Trips/EditTrip"
import SendLaunchUpdate from "../Launches/SendLaunchUpdate"

interface TripActionsMenuProps {
  trip: TripPublic
}

const TripActionsMenu = ({ trip }: TripActionsMenuProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [sendUpdateOpen, setSendUpdateOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<TripPublic | null>(null)

  const { data: mission } = useQuery({
    queryKey: ["mission", trip.mission_id],
    queryFn: () => MissionsService.readMission({ missionId: trip.mission_id }),
    enabled: sendUpdateOpen,
  })

  const duplicateMutation = useMutation({
    mutationFn: () => TripsService.duplicateTrip({ tripId: trip.id }),
    onSuccess: (duplicated) => {
      setEditingTrip(duplicated)
      setEditModalOpen(true)
      showSuccessToast("Trip duplicated. Edit the new trip below.")
    },
    onError: handleError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] })
    },
  })

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingTrip(null)
  }

  const copyBookingLink = () => {
    const url = `${getPublicOrigin()}/book?trip=${trip.id}`
    void navigator.clipboard.writeText(url).then(() => {
      showSuccessToast("Booking link copied to clipboard")
    })
  }

  return (
    <>
      <ActionsMenu ariaLabel="Trip actions">
        <EditTrip trip={trip} />
        <EditTrip
          trip={trip}
          initialTab="boats"
          triggerLabel="Manage Boats"
        />
        <MenuItem
          value="duplicate"
          onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}
          asChild
        >
          <Button
            variant="ghost"
            size="sm"
            color="dark.accent.primary"
            justifyContent="start"
            w="full"
            disabled={duplicateMutation.isPending}
          >
            <FiCopy fontSize="16px" />
            Duplicate
          </Button>
        </MenuItem>
        <MenuItem value="send-update" onClick={() => setSendUpdateOpen(true)} asChild>
          <Button
            variant="ghost"
            size="sm"
            color="dark.accent.primary"
            justifyContent="start"
            w="full"
          >
            <FiMail fontSize="16px" />
            Send Update
          </Button>
        </MenuItem>
        <MenuItem value="copy-booking-link" onClick={copyBookingLink} asChild>
          <Button
            variant="ghost"
            size="sm"
            color="dark.accent.primary"
            justifyContent="start"
            w="full"
          >
            <FiLink fontSize="16px" />
            Copy Booking Link
          </Button>
        </MenuItem>
        <DeleteTrip id={trip.id} type={trip.type} />
      </ActionsMenu>
      <EditTrip
        trip={editingTrip ?? trip}
        isOpen={editModalOpen}
        onOpenChange={(open) => !open && handleCloseEdit()}
      />
      {mission && (
        <SendLaunchUpdate
          launchId={mission.launch_id}
          initialScope="trip"
          initialMissionId={trip.mission_id}
          initialTripId={trip.id}
          showTrigger={false}
          isOpen={sendUpdateOpen}
          onOpenChange={setSendUpdateOpen}
          dialogTitle="Send Trip Update"
        />
      )}
    </>
  )
}

export default TripActionsMenu
