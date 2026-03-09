import {
  Box,
  Container,
  Flex,
  Heading,
  Image,
  Span,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

import Logo from "/assets/images/qm-logo.svg"

interface BookingPageLayoutProps {
  children: React.ReactNode
  /** Optional subtitle shown to the right of the logo. */
  subtitle?: string
}

/**
 * Shared page shell for all public booking pages: branded header, hero
 * background, and Quartermaster footer. Used by AccessGate error/info
 * screens and wraps PublicBookingForm's own content area.
 */
const BookingPageLayout = ({ children, subtitle }: BookingPageLayoutProps) => {
  return (
    <Box
      position="relative"
      minH="100vh"
      backgroundImage="url(/assets/images/hero.jpg)"
      backgroundSize="cover"
      backgroundAttachment={{ base: "scroll", md: "fixed" }}
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.600"
        pointerEvents="none"
        zIndex={0}
      />
      <Box position="relative" zIndex={1}>
        <Box
          px={{ base: 4, md: 8 }}
          py={{ base: 4, md: 6 }}
          bg="dark.bg.primary"
          color="white"
        >
          <Container maxW="container.lg">
            <Flex
              direction={{ base: "column", md: "row" }}
              justify="space-between"
              align={{ base: "stretch", md: "center" }}
              gap={{ base: 3, md: 0 }}
            >
              <Link to="/book" search={{}} style={{ textDecoration: "none" }}>
                <Heading
                  fontFamily="logo"
                  size={{ base: "2xl", md: "3xl" }}
                  fontWeight="400"
                  color="white"
                  _hover={{ opacity: 0.85 }}
                  transition="opacity 0.15s"
                >
                  Star<Span color="dark.accent.primary">✦</Span>Fleet Tours
                </Heading>
              </Link>
              {subtitle && (
                <Heading size={{ base: "lg", md: "2xl" }}>{subtitle}</Heading>
              )}
            </Flex>
          </Container>
        </Box>

        {children}

        <Box px={{ base: 4, md: 8 }} py={6}>
          <Container maxW="container.lg" display="flex" justifyContent="center">
            <VStack gap={4}>
              <Text fontSize="sm" color="whiteAlpha.700">
                Powered by
              </Text>
              <Image src={Logo} alt="Logo" maxW="200px" />
            </VStack>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}

export default BookingPageLayout
