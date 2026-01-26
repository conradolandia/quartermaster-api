import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import type { LaunchPublic } from "@/client"
import DeleteLaunch from "../Launches/DeleteLaunch"
import EditLaunch from "../Launches/EditLaunch"
import SendLaunchUpdate from "../Launches/SendLaunchUpdate"

interface LaunchActionsMenuProps {
  launch: LaunchPublic
}

export const LaunchActionsMenu = ({ launch }: LaunchActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="ui.main">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <SendLaunchUpdate launch={launch} />
        <EditLaunch launch={launch} />
        <DeleteLaunch id={launch.id} />
      </MenuContent>
    </MenuRoot>
  )
}
