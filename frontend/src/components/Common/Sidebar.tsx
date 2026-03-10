import { Box, Flex, IconButton, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FaBars } from "react-icons/fa"
import { FiLogOut } from "react-icons/fi"

import type { UserPublic } from "@/client"
import useAuth from "@/hooks/useAuth"
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerRoot,
  DrawerTrigger,
} from "../ui/drawer"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <Box className="no-print">
      {/* Mobile: fixed header bar with background so hamburger stays visible when content scrolls */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        h={14}
        bg="dark.bg.secondary"
        zIndex={100}
        display={{ base: "flex", nav: "none" } as { base: "flex"; nav: "none" }}
        alignItems="center"
        px={4}
      >
        <DrawerRoot
          placement="start"
          open={open}
          onOpenChange={(e) => setOpen(e.open)}
        >
          <DrawerBackdrop />
          <DrawerTrigger asChild>
            <IconButton
              variant="ghost"
              color="inherit"
              aria-label="Open Menu"
            >
              <FaBars />
            </IconButton>
          </DrawerTrigger>
        <DrawerContent maxW="xs" bg="dark.bg.secondary">
          <DrawerCloseTrigger />
          <DrawerBody>
            <Flex flexDir="column" justify="space-between" h="100%">
              <Box>
                <SidebarItems onClose={() => setOpen(false)} />
                <Flex
                  as="button"
                  onClick={() => {
                    logout()
                  }}
                  alignItems="center"
                  gap={4}
                  px={4}
                  py={2}
                  color="text.secondary"
                  _hover={{
                    bg: "dark.bg.hover",
                    color: "text.primary",
                  }}
                  borderRadius="md"
                  mt={2}
                >
                  <FiLogOut />
                  <Text>Log Out</Text>
                </Flex>
              </Box>
              {currentUser?.email && (
                <Text
                  fontSize="sm"
                  p={2}
                  truncate
                  maxW="sm"
                  color="text.muted"
                  borderTop="1px solid"
                  borderColor="border.default"
                  mt={4}
                >
                  Logged in as: {currentUser.email}
                </Text>
              )}
            </Flex>
          </DrawerBody>
          <DrawerCloseTrigger />
        </DrawerContent>
        </DrawerRoot>
      </Box>

      {/* Desktop */}
      <Box
        display={{ base: "none", nav: "flex" } as { base: "none"; nav: "flex" }}
        position="sticky"
        bg="dark.bg.secondary"
        top={0}
        minW="xs"
        h="100vh"
        p={4}
        borderRight="1px solid"
        borderColor="border.default"
      >
        <Box w="100%">
          <SidebarItems />
        </Box>
      </Box>
    </Box>
  )
}

export default Sidebar
