import { Flex } from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router"

import Navbar from "@/components/Common/Navbar"
import Sidebar from "@/components/Common/Sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async ({ location }) => {
    // Allow access to bookings with confirmation code for unauthenticated users
    const isBookingsWithCode = location.pathname === "/bookings" &&
                             location.search &&
                             "code" in location.search &&
                             typeof location.search.code === "string"

    if (!isLoggedIn() && !isBookingsWithCode) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const router = useRouter()

  // Check if this is a public booking confirmation (unauthenticated access)
  const isPublicBookingConfirmation = router.state.location.pathname === "/bookings" &&
                                    router.state.location.search &&
                                    "code" in router.state.location.search &&
                                    typeof router.state.location.search.code === "string" &&
                                    !isLoggedIn()

  // For public booking confirmations, don't show navbar and sidebar
  if (isPublicBookingConfirmation) {
    return <Outlet />
  }

  // For authenticated users or other routes, show the full layout
  return (
    <Flex direction="column" h="100vh">
      <Navbar />
      <Flex flex="1" overflow="hidden">
        <Sidebar />
        <Flex flex="1" direction="column" p={4} overflowY="auto">
          <Outlet />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default Layout
