import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"

import type { ProviderPublic } from "@/client"
import DeleteProvider from "../Providers/DeleteProvider"
import EditProvider from "../Providers/EditProvider"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

interface ProviderActionsMenuProps {
  provider: ProviderPublic
}

export const ProviderActionsMenu = ({ provider }: ProviderActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          aria-label="Provider actions"
          variant="ghost"
          color="ui.main"
        >
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditProvider provider={provider} />
        <DeleteProvider provider={provider} />
      </MenuContent>
    </MenuRoot>
  )
}

export default ProviderActionsMenu
