"use client"

import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"

import { MenuContent, MenuRoot, MenuTrigger } from "./menu"

interface ActionsMenuProps {
  children: React.ReactNode
  /** Accessible label for the trigger button. */
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Shared actions menu shell: three-dots trigger + menu content slot.
 * Use for row actions across management tables (launches, missions, trips, etc.).
 */
export function ActionsMenu({
  children,
  ariaLabel = "Actions",
  disabled = false,
}: ActionsMenuProps) {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          aria-label={ariaLabel}
          variant="ghost"
          size="sm"
          color="ui.main"
          disabled={disabled}
        >
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>{children}</MenuContent>
    </MenuRoot>
  )
}
