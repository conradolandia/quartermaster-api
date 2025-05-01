import { Box } from "@chakra-ui/react"
import { FaEllipsisH } from "react-icons/fa"
import React from "react"

import { type JurisdictionPublic } from "@/client"
import DeleteJurisdiction from "../Jurisdictions/DeleteJurisdiction"
import EditJurisdiction from "../Jurisdictions/EditJurisdiction"
import {
  MenuRoot as Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuItemText,
} from "../ui/menu"

interface JurisdictionActionsMenuProps {
  jurisdiction: JurisdictionPublic
}

export const JurisdictionActionsMenu = ({
  jurisdiction,
}: JurisdictionActionsMenuProps) => {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          style={{
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: "8px",
            borderRadius: "50%"
          }}
          aria-label="More actions"
        >
          <FaEllipsisH />
        </button>
      </MenuTrigger>
      <MenuContent minW="240px">
        <MenuItemText fontWeight="bold" px="3" py="2">Actions</MenuItemText>
        <MenuSeparator />
        <MenuItem value="edit">
          <Box w="full">
            <EditJurisdiction jurisdiction={jurisdiction} />
          </Box>
        </MenuItem>
        <MenuItem value="delete">
          <Box w="full">
            <DeleteJurisdiction jurisdiction={jurisdiction} />
          </Box>
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export default JurisdictionActionsMenu
