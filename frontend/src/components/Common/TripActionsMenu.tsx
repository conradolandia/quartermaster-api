import { TripsService, type TripPublic } from "../../client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCopy } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteTrip from "../Trips/DeleteTrip"
import EditTrip from "../Trips/EditTrip"

interface TripActionsMenuProps {
  trip: TripPublic
}

const TripActionsMenu = ({ trip }: TripActionsMenuProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<TripPublic | null>(null)

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

  return (
    <>
      <ActionsMenu ariaLabel="Trip actions">
        <EditTrip trip={trip} />
        <EditTrip
          trip={trip}
          initialTab="boats"
          triggerLabel="Manage Boats for Trip"
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
        <DeleteTrip id={trip.id} type={trip.type} />
      </ActionsMenu>
      <EditTrip
        trip={editingTrip ?? trip}
        isOpen={editModalOpen}
        onOpenChange={(open) => !open && handleCloseEdit()}
      />
    </>
  )
}

export default TripActionsMenu
