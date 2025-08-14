import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"

import type { JurisdictionPublic } from "@/client"
import DeleteJurisdiction from "../Jurisdictions/DeleteJurisdiction"
import EditJurisdiction from "../Jurisdictions/EditJurisdiction"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

interface JurisdictionActionsMenuProps {
  jurisdiction: JurisdictionPublic
}

export const JurisdictionActionsMenu = ({
  jurisdiction,
}: JurisdictionActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          aria-label="Jurisdiction actions"
          variant="ghost"
          color="ui.main"
        >
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditJurisdiction jurisdiction={jurisdiction} />
        <DeleteJurisdiction jurisdiction={jurisdiction} />
      </MenuContent>
    </MenuRoot>
  )
}

export default JurisdictionActionsMenu
