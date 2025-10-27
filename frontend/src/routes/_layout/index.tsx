import { Box, Container, Text } from "@chakra-ui/react"
import { createFileRoute, Navigate } from "@tanstack/react-router"

import DashboardStats from "@/components/Admin/DashboardStats"
import { DEFAULT_HOME_PATH } from "@/components/Common/SidebarItems"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { user: currentUser } = useAuth()

  // Redirect to the configured default home page if it's not "/"
  if (DEFAULT_HOME_PATH !== "/") {
    return <Navigate to={DEFAULT_HOME_PATH} />
  }

  if (!currentUser) {
    return (
      <Container maxW="full">
        <Box pt={12} m={4}>
          <Text>Please log in to access the dashboard.</Text>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <Box pt={12} m={4}>
        <Text fontSize="2xl" truncate maxW="sm" mb={6}>
          Hi, {currentUser?.full_name || currentUser?.email} 👋🏼
        </Text>
        <Text mb={8}>Welcome back! Here's your business overview.</Text>
        <DashboardStats />
      </Box>
    </Container>
  )
}
