import { MerchandiseService, type MerchandisePublic } from "../../client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FiCopy } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteMerchandise from "../Merchandise/DeleteMerchandise"
import EditMerchandise from "../Merchandise/EditMerchandise"

interface MerchandiseActionsMenuProps {
  merchandise: MerchandisePublic
}

export const MerchandiseActionsMenu = ({
  merchandise,
}: MerchandiseActionsMenuProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMerchandise, setEditingMerchandise] =
    useState<MerchandisePublic | null>(null)

  const duplicateMutation = useMutation({
    mutationFn: () =>
      MerchandiseService.duplicateMerchandise({
        merchandiseId: merchandise.id,
      }),
    onSuccess: (duplicated) => {
      setEditingMerchandise(duplicated)
      setEditModalOpen(true)
      showSuccessToast("Merchandise duplicated. Edit the new item below.")
    },
    onError: handleError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["merchandise"] })
    },
  })

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setEditingMerchandise(null)
  }

  return (
    <>
      <ActionsMenu ariaLabel="Merchandise actions">
        <EditMerchandise merchandise={merchandise} />
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
        <DeleteMerchandise id={merchandise.id} />
      </ActionsMenu>
      <EditMerchandise
        merchandise={editingMerchandise ?? merchandise}
        isOpen={editModalOpen}
        onOpenChange={(open) => !open && handleCloseEdit()}
      />
    </>
  )
}
