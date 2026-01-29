import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import React, { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { routeTree } from "./routeTree.gen"

import { ApiError, OpenAPI } from "./client"
import { CustomProvider } from "./components/ui/provider"

// Route protection based on hostname
// Base domain (e.g., book.star-fleet.tours) only allows public routes
// Admin routes are only accessible via admin subdomain (e.g., admin.book.star-fleet.tours)
// Localhost is unrestricted for development
const hostname = window.location.hostname
const pathname = window.location.pathname
const search = window.location.search
const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1"
const isAdminDomain = !isLocalhost && hostname.startsWith("admin.")
const isBaseDomain = !isLocalhost && !hostname.startsWith("admin.")

// Public routes allowed on base domain (book.star-fleet.tours)
// /bookings with ?code= is the public booking confirmation; layout restricts unauthenticated access to that
const publicRoutes = ["/book", "/book-confirm", "/bookings", "/lookup", "/login", "/reset-password", "/recover-password"]
const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + "/"))
const isRootPath = pathname === "/" || pathname === ""

// Option 2: Redirect unauthenticated users from admin.*/bookings?code=... to public URL
const publicBookingBaseUrl = (import.meta as any).env?.VITE_PUBLIC_BOOKING_BASE_URL as string | undefined
const hasBookingCode = search && /[?&]code=/.test(search)
if (isAdminDomain && pathname === "/bookings" && hasBookingCode && publicBookingBaseUrl) {
  const hasToken = !!localStorage.getItem("access_token")
  if (!hasToken) {
    const publicUrl = `${publicBookingBaseUrl.replace(/\/$/, "")}${pathname}${search}`
    window.location.replace(publicUrl)
  }
}

if (isBaseDomain) {
  if (isRootPath) {
    // Redirect root to /book on base domain
    window.location.replace("/book")
  } else if (!isPublicRoute) {
    // Redirect admin routes to /book on base domain
    window.location.replace("/book")
  }
}

OpenAPI.BASE = (import.meta as any).env?.VITE_API_URL || ""
OpenAPI.TOKEN = async () => {
  return localStorage.getItem("access_token") || ""
}

const handleApiError = (error: Error) => {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  }
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CustomProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CustomProvider>
  </StrictMode>,
)
