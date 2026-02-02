import { ActionsMenu } from "../ui/actions-menu"
import DeleteMission from "../Missions/DeleteMission"
import EditMission from "../Missions/EditMission"

interface Mission {
  id: string
  name: string
  launch_id: string
  active: boolean
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
    <ActionsMenu ariaLabel="Mission actions">
      <EditMission mission={mission} />
      <DeleteMission id={mission.id} name={mission.name} />
    </ActionsMenu>
  )
}

export default MissionActionsMenu
