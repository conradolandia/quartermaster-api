import type { LaunchPublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteLaunch from "../Launches/DeleteLaunch"
import EditLaunch from "../Launches/EditLaunch"
import SendLaunchUpdate from "../Launches/SendLaunchUpdate"

interface LaunchActionsMenuProps {
  launch: LaunchPublic
}

export const LaunchActionsMenu = ({ launch }: LaunchActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Launch actions">
      <SendLaunchUpdate launch={launch} />
      <EditLaunch launch={launch} />
      <DeleteLaunch id={launch.id} />
    </ActionsMenu>
  )
}
