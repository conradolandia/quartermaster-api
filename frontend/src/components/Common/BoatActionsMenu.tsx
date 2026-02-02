import type { Boat } from "../../types/boat"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteBoat from "../Boats/DeleteBoat"
import EditBoat from "../Boats/EditBoat"

interface BoatActionsMenuProps {
  boat: Boat
}

export const BoatActionsMenu = ({ boat }: BoatActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Boat actions">
      <EditBoat boat={boat} />
      <DeleteBoat id={boat.id} name={boat.name} />
    </ActionsMenu>
  )
}

export default BoatActionsMenu
