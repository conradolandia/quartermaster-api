import { Flex, Image, useBreakpointValue } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

import Logo from "/assets/images/qm-logo.svg"
import { DEFAULT_HOME_PATH } from "./SidebarItems"
import UserMenu from "./UserMenu"

function Navbar() {
  const display = useBreakpointValue({ base: "none", nav: "flex" } as Record<string, "none" | "flex">)

  return (
    <Flex
      display={display}
      justify="space-between"
      position="sticky"
      color="dark.text.secondary"
      align="center"
      bg="bg.accent"
      w="100%"
      top={0}
      p={4}
    >
      <Link to={DEFAULT_HOME_PATH}>
        <Image src={Logo} alt="Star✦Fleet Tours" maxW="320px" p={2} />
      </Link>
      <Flex gap={2} alignItems="center">
        <UserMenu />
      </Flex>
    </Flex>
  )
}

export default Navbar
