import React from "react"
import { FiCopy } from "react-icons/fi"
import { Button } from "@chakra-ui/react"

import useCustomToast from "../../hooks/useCustomToast"
import type { Boat } from "../../types/boat"
import { ActionsMenu } from "../ui/actions-menu"
import { MenuItem } from "../ui/menu"
import DeleteBoat from "../Boats/DeleteBoat"
import EditBoat from "../Boats/EditBoat"

interface BoatActionsMenuProps {
  boat: Boat
}

export const BoatActionsMenu = ({ boat }: BoatActionsMenuProps) => {
  const { showSuccessToast } = useCustomToast()

  const copyId = () => {
    void navigator.clipboard.writeText(boat.id).then(() => {
      showSuccessToast("Boat ID copied to clipboard")
    })
  }

  return (
    <ActionsMenu ariaLabel="Boat actions">
      <MenuItem value="copy-id" onClick={copyId} asChild>
        <Button
          variant="ghost"
          size="sm"
          color="dark.accent.primary"
          justifyContent="start"
          w="full"
        >
          <FiCopy fontSize="16px" />
          Copy ID
        </Button>
      </MenuItem>
      <EditBoat boat={boat} />
      <DeleteBoat id={boat.id} name={boat.name} />
    </ActionsMenu>
  )
}

export default BoatActionsMenu
