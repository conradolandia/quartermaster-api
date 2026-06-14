import { Flex, Spinner } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useEffect } from "react"

import type { UserPublic } from "@/client"
import { UsersService } from "@/client"
import Navbar from "@/components/Common/Navbar"
import Sidebar from "@/components/Common/Sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

/**
 * Clears stuck body pointer-events/data-inert when no modal/drawer is mounted.
 * Chakra/Ark layer stack can leave body blocked in edge cases (tab switch, rapid
 * close, navigation during close). Safe to run: only clears when no dialog/drawer
 * elements exist in DOM.
 */
function fixStuckModalState(): void {
  const hasModal =
    document.querySelectorAll('[data-scope="dialog"], [data-scope="drawer"]')
      .length > 0
  if (hasModal) return

  const { body } = document
  if (body.style.pointerEvents === "none" || body.hasAttribute("data-inert")) {
    body.style.pointerEvents = ""
    body.removeAttribute("data-inert")
    if (body.style.length === 0) body.removeAttribute("style")
  }
}

function hasBookingConfirmationCode(location: {
  pathname: string
  search: unknown
}): boolean {
  const search = location.search as Record<string, unknown> | undefined
  return (
    location.pathname === "/bookings" &&
    !!search &&
    "code" in search &&
    typeof search.code === "string" &&
    search.code.length > 0
  )
}

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async ({ location }) => {
    // Allow unauthenticated access to public booking and confirmation routes
    const isBook = location.pathname === "/book"
    const isBookingsWithCode = hasBookingConfirmationCode(location)

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
  const { data: currentUser, status, isError } = useQuery<UserPublic | null>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

  // All hooks must run on every render (no conditional hooks)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fixStuckModalState()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  useEffect(() => {
    fixStuckModalState()
  }, [router.state.location.pathname])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fixStuckModalState()
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const location = router.state.location
  const bookingConfirmationCode = hasBookingConfirmationCode(location)

  const isAuthenticatedSuperuser =
    isLoggedIn() &&
    status === "success" &&
    currentUser != null &&
    currentUser.is_superuser

  // Wait for auth before choosing layout when a token is present
  if (isLoggedIn() && status === "pending") {
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" color="white" />
      </Flex>
    )
  }

  // Public confirmation layout: guests, or stale token on /bookings?code=
  if (bookingConfirmationCode && !isAuthenticatedSuperuser) {
    if (
      isLoggedIn() &&
      status !== "pending" &&
      (isError || currentUser == null)
    ) {
      localStorage.removeItem("access_token")
      queryClient.removeQueries({ queryKey: ["currentUser"] })
    }
    return <Outlet />
  }

  // Token present but auth failed or no user (non-confirmation routes)
  if (
    isLoggedIn() &&
    status !== "pending" &&
    (isError || currentUser == null)
  ) {
    localStorage.removeItem("access_token")
    queryClient.removeQueries({ queryKey: ["currentUser"] })
    throw redirect({ to: "/login" })
  }

  // Require superuser for dashboard access
  if (isLoggedIn() && currentUser && !currentUser.is_superuser) {
    throw redirect({
      to: "/login",
    })
  }

  // Authenticated superusers and other protected routes: full admin chrome
  return (
    <Flex
      direction="column"
      h="100vh"
      data-print-layout
    >
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
