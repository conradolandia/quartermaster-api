import {
  LaunchesService,
  type LaunchPublic,
} from "../../client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCopy } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteLaunch from "../Launches/DeleteLaunch"
import EditLaunch from "../Launches/EditLaunch"
import SendLaunchUpdate from "../Launches/SendLaunchUpdate"

interface LaunchActionsMenuProps {
  launch: LaunchPublic
}

export const LaunchActionsMenu = ({ launch }: LaunchActionsMenuProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingLaunch, setEditingLaunch] = useState<LaunchPublic | null>(null)

  const duplicateMutation = useMutation({
    mutationFn: () =>
      LaunchesService.duplicateLaunch({ launchId: launch.id }),
    onSuccess: (duplicated) => {
      setEditingLaunch(duplicated)
      setEditModalOpen(true)
      showSuccessToast("Launch duplicated. Edit the new launch below.")
    },
    onError: handleError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["launches"] })
    },
  })

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingLaunch(null)
  }

  return (
    <>
      <ActionsMenu ariaLabel="Launch actions">
        <SendLaunchUpdate launch={launch} />
        <EditLaunch launch={launch} />
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
        <DeleteLaunch id={launch.id} />
      </ActionsMenu>
      <EditLaunch
        launch={editingLaunch ?? launch}
        isOpen={editModalOpen}
        onOpenChange={(open) => !open && handleCloseEdit()}
      />
    </>
  )
}
