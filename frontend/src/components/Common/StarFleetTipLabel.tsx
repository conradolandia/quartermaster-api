import {
  HStack,
  IconButton,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react"
import { FiHelpCircle } from "react-icons/fi"

export const STAR_FLEET_TIP_TOOLTIP =
  "Entirely optional but always appreciated! Your tip here supports Star Fleet's efforts to bring inspiring launch experiences to everyone. In turn, we generously tip the captains we work with, but if you'd like to give them something extra on top of that, the best way to do so is directly to them after your trip."

interface StarFleetTipLabelProps {
  showColon?: boolean
  /** Show tooltip with info about tips and boat captains. Default true for public booking, false for admin. */
  showTooltip?: boolean
}

export function StarFleetTipLabel({ showColon, showTooltip = true }: StarFleetTipLabelProps) {
  return (
    <HStack gap={1} align="center" display="inline-flex">
      <Text as="span">Star Fleet Tip{showColon ? ":" : ""}</Text>
      {showTooltip && (
        <TooltipRoot openDelay={300} closeDelay={100}>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="What is Star Fleet Tip?"
              variant="ghost"
              size="xs"
              minW="6"
              minH="6"
            >
              <FiHelpCircle />
            </IconButton>
          </TooltipTrigger>
          <TooltipPositioner>
            <TooltipContent maxW="320px" px={3} py={2}>
              {STAR_FLEET_TIP_TOOLTIP}
            </TooltipContent>
          </TooltipPositioner>
        </TooltipRoot>
      )}
    </HStack>
  )
}
