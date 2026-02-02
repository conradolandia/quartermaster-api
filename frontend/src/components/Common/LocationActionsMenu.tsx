import type { LocationPublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteLocation from "../Locations/DeleteLocation"
import EditLocation from "../Locations/EditLocation"

interface LocationActionsMenuProps {
  location: LocationPublic
}

export const LocationActionsMenu = ({ location }: LocationActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Location actions">
      <EditLocation location={location} />
      <DeleteLocation id={location.id} />
    </ActionsMenu>
  )
}
