import { Box, Flex, Icon, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink, useMatchRoute } from "@tanstack/react-router"
import { FiHome, FiSettings, FiUsers } from "react-icons/fi"
import type { IconType } from "react-icons/lib"

import type { UserPublic } from "@/client"
import {
  FaBalanceScale,
  FaMapMarked,
  FaRocket,
  FaRoute,
  FaShip,
  FaSpaceShuttle,
  FaTicketAlt,
} from "react-icons/fa"

const items = [
  { icon: FiHome, title: "Dashboard", path: "/" },
  { icon: FaTicketAlt, title: "Bookings", path: "/bookings" },
  { icon: FaRoute, title: "Trips", path: "/trips" },
  { icon: FaSpaceShuttle, title: "Missions", path: "/missions" },
  { icon: FaRocket, title: "Launches", path: "/launches" },
  { icon: FaMapMarked, title: "Locations", path: "/locations" },
  { icon: FaBalanceScale, title: "Jurisdictions", path: "/jurisdictions" },
  { icon: FaShip, title: "Boats", path: "/boats" },
  { icon: FiSettings, title: "Settings", path: "/settings" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

interface Item {
  icon: IconType
  title: string
  path: string
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const matchRoute = useMatchRoute()

  const finalItems: Item[] = currentUser?.is_superuser
    ? [...items, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : items

  const listItems = finalItems.map(({ icon, title, path }) => {
    // Check if the current route matches this item's path
    const isActive = matchRoute({ to: path })

    return (
      <RouterLink key={title} to={path} onClick={onClose}>
        <Flex
          gap={3}
          px={3}
          py={3}
          mx={1}
          borderRadius="md"
          transition="all 0.2s"
          _hover={{
            bg: isActive ? "dark.accent.hover" : "dark.bg.hover",
            color: isActive ? "dark.bg.primary" : "text.primary",
          }}
          alignItems="center"
          fontSize="sm"
          color={isActive ? "dark.bg.primary" : "text.secondary"}
          borderLeft="3px solid"
          bg={isActive ? "dark.accent.primary" : "transparent"}
          fontWeight={isActive ? "bold" : "normal"}
          borderColor={isActive ? "dark.accent.primary" : "transparent"}
          cursor="pointer"
        >
          <Icon as={icon} alignSelf="center" boxSize={4} />
          <Text>{title}</Text>
        </Flex>
      </RouterLink>
    )
  })

  return (
    <>
      <Text
        fontSize="xs"
        px={4}
        py={3}
        fontWeight="bold"
        color="text.muted"
        textTransform="uppercase"
        letterSpacing="wider"
      >
        Menu
      </Text>
      <Box mt={2}>{listItems}</Box>
    </>
  )
}

export default SidebarItems
