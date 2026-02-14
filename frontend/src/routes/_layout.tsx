import { Flex } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useEffect } from "react"

import type { UserPublic } from "@/client"
import Navbar from "@/components/Common/Navbar"
import Sidebar from "@/components/Common/Sidebar"
import { isLoggedIn } from "@/hooks/useAuth"
import { debugLog } from "@/utils/debugLog"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async ({ location }) => {
    // Allow unauthenticated access to public booking and confirmation routes
    const isBook = location.pathname === "/book"
    const isBookingsWithCode =
      location.pathname === "/bookings" &&
      location.search &&
      "code" in location.search &&
      typeof location.search.code === "string"

    if (!isLoggedIn() && !isBook && !isBookingsWithCode) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  // Check if this is a public booking confirmation (unauthenticated access)
  const isPublicBookingConfirmation =
    router.state.location.pathname === "/bookings" &&
    router.state.location.search &&
    "code" in router.state.location.search &&
    typeof router.state.location.search.code === "string" &&
    !isLoggedIn()

  // For public booking confirmations, don't show navbar and sidebar
  if (isPublicBookingConfirmation) {
    return <Outlet />
  }

  // Require superuser for dashboard access
  if (isLoggedIn() && currentUser && !currentUser.is_superuser) {
    throw redirect({
      to: "/login",
    })
  }

  // Minimal periodic DOM state log for sidebar unclickable bug monitoring
  useEffect(() => {
    const id = setInterval(() => {
      debugLog("Layout DOM state")
    }, 15000)
    return () => clearInterval(id)
  }, [])

  // For authenticated superusers or other routes, show the full layout
  return (
    <Flex direction="column" h="100vh">
      <Navbar />
      <Flex flex="1" overflow="hidden">
        <Sidebar />
        <Flex
          flex="1"
          direction="column"
          p={4}
          pt={{ base: 14, nav: 4 } as { base: number; nav: number }}
          overflowY="auto"
        >
          <Outlet />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default Layout
