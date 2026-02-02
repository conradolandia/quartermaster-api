import type { UserPublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteUser from "../Admin/DeleteUser"
import EditUser from "../Admin/EditUser"

interface UserActionsMenuProps {
  user: UserPublic
  disabled?: boolean
}

export const UserActionsMenu = ({ user, disabled }: UserActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="User actions" disabled={disabled}>
      <EditUser user={user} />
      <DeleteUser id={user.id} />
    </ActionsMenu>
  )
}
