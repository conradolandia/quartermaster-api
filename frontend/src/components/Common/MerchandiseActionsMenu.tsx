import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import type { MerchandisePublic } from "@/client"
import DeleteMerchandise from "../Merchandise/DeleteMerchandise"
import EditMerchandise from "../Merchandise/EditMerchandise"

interface MerchandiseActionsMenuProps {
  merchandise: MerchandisePublic
}

export const MerchandiseActionsMenu = ({
  merchandise,
}: MerchandiseActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="ui.main">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <EditMerchandise merchandise={merchandise} />
        <DeleteMerchandise id={merchandise.id} />
      </MenuContent>
    </MenuRoot>
  )
}
