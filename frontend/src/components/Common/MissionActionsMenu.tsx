import { type MissionPublic, MissionsService } from "../../client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCopy, FiMail } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteMission from "../Missions/DeleteMission"
import EditMission from "../Missions/EditMission"
import SendLaunchUpdate from "../Launches/SendLaunchUpdate"

interface Mission {
  id: string
  name: string
  launch_id: string
  active: boolean
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
}

interface MissionActionsMenuProps {
  mission: Mission
}

export const MissionActionsMenu = ({ mission }: MissionActionsMenuProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [sendUpdateOpen, setSendUpdateOpen] = useState(false)
  const [editingMission, setEditingMission] = useState<MissionPublic | null>(
    null,
  )

  const duplicateMutation = useMutation({
    mutationFn: () =>
      MissionsService.duplicateMission({ missionId: mission.id }),
    onSuccess: (duplicated) => {
      setEditingMission(duplicated)
      setEditModalOpen(true)
      showSuccessToast("Mission duplicated. Edit the new mission below.")
    },
    onError: handleError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] })
    },
  })

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingMission(null)
  }

  return (
    <>
      <ActionsMenu ariaLabel="Mission actions">
        <EditMission mission={mission} />
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
        <DeleteMission id={mission.id} name={mission.name} />
      </ActionsMenu>
      <EditMission
        mission={
          editingMission
            ? {
                ...editingMission,
                active: editingMission.active ?? false,
                refund_cutoff_hours: editingMission.refund_cutoff_hours ?? 0,
              }
            : mission
        }
        isOpen={editModalOpen}
        onOpenChange={(open) => !open && handleCloseEdit()}
      />
      <SendLaunchUpdate
        launchId={mission.launch_id}
        initialScope="mission"
        initialMissionId={mission.id}
        showTrigger={false}
        isOpen={sendUpdateOpen}
        onOpenChange={setSendUpdateOpen}
        dialogTitle="Send Mission Update"
      />
    </>
  )
}

export default MissionActionsMenu
