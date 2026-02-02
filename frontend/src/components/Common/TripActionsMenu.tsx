import type { TripPublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteTrip from "../Trips/DeleteTrip"
import EditTrip from "../Trips/EditTrip"

interface TripActionsMenuProps {
  trip: TripPublic
}

const TripActionsMenu = ({ trip }: TripActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Trip actions">
      <EditTrip trip={trip} />
      <EditTrip
        trip={trip}
        initialTab="boats"
        triggerLabel="Manage Boats for Trip"
      />
      <DeleteTrip id={trip.id} type={trip.type} />
    </ActionsMenu>
  )
}

export default TripActionsMenu
