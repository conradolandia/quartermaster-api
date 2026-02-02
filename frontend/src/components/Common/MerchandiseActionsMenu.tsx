import React from "react"

import type { MerchandisePublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteMerchandise from "../Merchandise/DeleteMerchandise"
import EditMerchandise from "../Merchandise/EditMerchandise"

interface MerchandiseActionsMenuProps {
  merchandise: MerchandisePublic
}

export const MerchandiseActionsMenu = ({
  merchandise,
}: MerchandiseActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Merchandise actions">
      <EditMerchandise merchandise={merchandise} />
      <DeleteMerchandise id={merchandise.id} />
    </ActionsMenu>
  )
}
