import type { TripPublic } from "@/client"
import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import DeleteTrip from "../Trips/DeleteTrip"
import EditTrip from "../Trips/EditTrip"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

interface TripActionsMenuProps {
  trip: TripPublic
}

const TripActionsMenu = ({ trip }: TripActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton aria-label="Trip actions" variant="ghost" color="ui.main">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditTrip trip={trip} />
        <EditTrip
          trip={trip}
          initialTab="boats"
          triggerLabel="Manage Boats for Trip"
        />
        <DeleteTrip id={trip.id} type={trip.type} />
      </MenuContent>
    </MenuRoot>
  )
}

export default TripActionsMenu
