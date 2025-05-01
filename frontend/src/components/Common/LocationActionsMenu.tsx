import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import type { LocationPublic } from "@/client"
import DeleteLocation from "../Locations/DeleteLocation"
import EditLocation from "../Locations/EditLocation"

interface LocationActionsMenuProps {
  location: LocationPublic
}

export const LocationActionsMenu = ({ location }: LocationActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="inherit">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditLocation location={location} />
        <DeleteLocation id={location.id} />
      </MenuContent>
    </MenuRoot>
  )
}
