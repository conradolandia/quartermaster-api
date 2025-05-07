import { Box, Flex, Icon, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink, useMatchRoute } from "@tanstack/react-router"
import { FiHome, FiSettings, FiUsers } from "react-icons/fi"
import type { IconType } from "react-icons/lib"

import type { UserPublic } from "@/client"
import { FaBalanceScale, FaMapMarked, FaRocket, FaShip, FaSpaceShuttle } from "react-icons/fa"

const items = [
  { icon: FiHome, title: "Dashboard", path: "/" },
  { icon: FaRocket, title: "Launches", path: "/launches" },
  { icon: FaSpaceShuttle, title: "Missions", path: "/missions" },
  { icon: FaBalanceScale, title: "Jurisdictions", path: "/jurisdictions" },
  { icon: FaMapMarked, title: "Locations", path: "/locations" },
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
          gap={4}
          px={4}
          py={2}
          _hover={{
            background: isActive ? "ui.main" : "gray.subtle",
          }}
          alignItems="center"
          fontSize="sm"
          color="inherit"
          borderLeft="3px solid"
          bg={isActive ? "ui.main" : "transparent"}
          fontWeight={isActive ? "bold" : "normal"}
          borderColor={isActive ? "ui.accent" : "transparent"}
        >
          <Icon as={icon} alignSelf="center" />
          <Text ml={2}>{title}</Text>
        </Flex>
      </RouterLink>
    )
  })

  return (
    <>
      <Text fontSize="xs" px={4} py={2} fontWeight="bold">
        Menu
      </Text>
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
