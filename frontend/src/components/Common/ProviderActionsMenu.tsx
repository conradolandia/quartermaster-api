import React from "react"

import type { ProviderPublic } from "../../client"
import DeleteProvider from "../Providers/DeleteProvider"
import EditProvider from "../Providers/EditProvider"
import { ActionsMenu } from "../ui/actions-menu"

interface ProviderActionsMenuProps {
  provider: ProviderPublic
}

export const ProviderActionsMenu = ({ provider }: ProviderActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Provider actions">
      <EditProvider provider={provider} />
      <DeleteProvider provider={provider} />
    </ActionsMenu>
  )
}

export default ProviderActionsMenu
