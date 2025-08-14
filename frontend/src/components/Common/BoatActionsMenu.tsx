import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import type { Boat } from "../../types/boat"
import DeleteBoat from "../Boats/DeleteBoat"
import EditBoat from "../Boats/EditBoat"

interface BoatActionsMenuProps {
  boat: Boat
}

export const BoatActionsMenu = ({ boat }: BoatActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton aria-label="Boat actions" variant="ghost" color="ui.main">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditBoat boat={boat} />
        <DeleteBoat id={boat.id} name={boat.name} />
      </MenuContent>
    </MenuRoot>
  )
}

export default BoatActionsMenu
