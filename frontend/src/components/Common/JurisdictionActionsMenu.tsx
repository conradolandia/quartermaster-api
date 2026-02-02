import type { JurisdictionPublic } from "../../client"
import { ActionsMenu } from "../ui/actions-menu"
import DeleteJurisdiction from "../Jurisdictions/DeleteJurisdiction"
import EditJurisdiction from "../Jurisdictions/EditJurisdiction"

interface JurisdictionActionsMenuProps {
  jurisdiction: JurisdictionPublic
}

export const JurisdictionActionsMenu = ({
  jurisdiction,
}: JurisdictionActionsMenuProps) => {
  return (
    <ActionsMenu ariaLabel="Jurisdiction actions">
      <EditJurisdiction jurisdiction={jurisdiction} />
      <DeleteJurisdiction jurisdiction={jurisdiction} />
    </ActionsMenu>
  )
}

export default JurisdictionActionsMenu
