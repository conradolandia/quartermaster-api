import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import DeleteMission from "../Missions/DeleteMission"
import EditMission from "../Missions/EditMission"

interface Mission {
  id: string
  name: string
  launch_id: string
  active: boolean
  public: boolean
  sales_open_at: string | null
  refund_cutoff_hours: number
  created_at: string
  updated_at: string
}

interface MissionActionsMenuProps {
  mission: Mission
}

export const MissionActionsMenu = ({ mission }: MissionActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="ui.main">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditMission mission={mission} />
        <DeleteMission id={mission.id} name={mission.name} />
      </MenuContent>
    </MenuRoot>
  )
}

export default MissionActionsMenu
