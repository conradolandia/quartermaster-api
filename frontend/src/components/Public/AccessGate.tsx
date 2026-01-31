import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { DiscountCodesService, TripsService } from "@/client"

interface AccessGateProps {
  accessCode?: string
  onAccessGranted: (accessCode: string | null, discountCodeId: string | null) => void
  /** accessCodeValue, discountCodeId (for early_bird missions) */
  children: (accessCodeValue: string | null, discountCodeId: string | null) => React.ReactNode
}

/**
 * AccessGate component that controls access to the booking form based on
 * mission booking_mode settings.
 *
 * - If trips are available (public or early_bird with valid code): shows children
 * - If early_bird mode without code: shows access code entry form
 * - If no trips available (all private): shows "not available" message
 */
const AccessGate = ({ accessCode: initialAccessCode, onAccessGranted, children }: AccessGateProps) => {
  const [accessCode, setAccessCode] = useState(initialAccessCode || "")
  const [submittedCode, setSubmittedCode] = useState(initialAccessCode || "")
  const [codeError, setCodeError] = useState<string | null>(null)

  // Sync state when initialAccessCode prop changes (e.g., URL parameter changes)
  // This allows URL parameters like ?access=EARLY23 to automatically trigger validation
  useEffect(() => {
    if (initialAccessCode) {
      const trimmedCode = initialAccessCode.trim()
      setAccessCode(trimmedCode)
      setSubmittedCode(trimmedCode)
      setCodeError(null)
    } else if (initialAccessCode === undefined || initialAccessCode === null) {
      // Only clear if explicitly undefined/null (not empty string from user input)
      // This prevents clearing user input when URL param is removed
      if (!submittedCode) {
        setAccessCode("")
      }
    }
  }, [initialAccessCode, submittedCode])

  // Fetch public trips (this will only return trips with public or early_bird booking_mode)
  const {
    data: tripsData,
    isLoading: isLoadingTrips,
    error: tripsError,
  } = useQuery({
    queryKey: ["public-trips", submittedCode],
    queryFn: () =>
      TripsService.readPublicTrips({
        limit: 100,
        accessCode: submittedCode || undefined,
      }),
  })

  // Validate access code if provided
  const {
    data: accessCodeValidation,
    isLoading: isValidatingCode,
  } = useQuery({
    queryKey: ["validate-access-code", submittedCode],
    queryFn: () =>
      DiscountCodesService.validateAccessCode({
        code: submittedCode,
      }),
    enabled: !!submittedCode,
  })

  // Derived after queries (safe when loading/error: optional chaining)
  const hasTrips = (tripsData?.data?.length ?? 0) > 0
  const accessCodeValid = accessCodeValidation?.valid === true

  // Notify parent when access is granted (effect only, never during render; must run on every render to satisfy Rules of Hooks)
  useEffect(() => {
    if (!hasTrips) return
    if (accessCodeValid && accessCodeValidation?.discount_code) {
      onAccessGranted(submittedCode, accessCodeValidation.discount_code.id)
    } else {
      onAccessGranted(null, null)
    }
  }, [hasTrips, accessCodeValid, accessCodeValidation?.discount_code, submittedCode, onAccessGranted])

  const handleSubmitCode = () => {
    if (!accessCode.trim()) {
      setCodeError("Please enter an access code")
      return
    }
    setCodeError(null)
    setSubmittedCode(accessCode.trim())
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmitCode()
    }
  }

  // Loading state
  if (isLoadingTrips || (submittedCode && isValidatingCode)) {
    return (
      <Container maxW="container.md" py={16}>
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Checking availability...</Text>
        </VStack>
      </Container>
    )
  }

  // Error state
  if (tripsError) {
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={4} textAlign="center">
              <Heading size="lg">Unable to Load Trips</Heading>
              <Text>
                We encountered an error while loading available trips. Please try again later.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    )
  }

  // If we have trips available, grant access and show children (pass discount code ID for early_bird)
  if (hasTrips) {
    const discountCodeId =
      accessCodeValid && accessCodeValidation?.discount_code
        ? accessCodeValidation.discount_code.id
        : null
    return <>{children(accessCodeValid ? submittedCode : null, discountCodeId)}</>
  }

  // No trips available - check if we need an access code
  // If user hasn't submitted a code yet, show the code entry form
  if (!submittedCode) {
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={6} textAlign="center">
              <Heading size="lg">Early Access Required</Heading>
              <Text>
                Tickets are not yet available to the public. If you have an early access code,
                enter it below to continue.
              </Text>
              <Box w="100%" maxW="400px">
                <VStack gap={4}>
                  <Input
                    placeholder="Enter access code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    onKeyDown={handleKeyPress}
                    size="lg"
                    textAlign="center"
                  />
                  {codeError && (
                    <Text color="red.500" fontSize="sm">
                      {codeError}
                    </Text>
                  )}
                  <Button
                    colorPalette="blue"
                    size="lg"
                    onClick={handleSubmitCode}
                    w="100%"
                  >
                    Continue
                  </Button>
                </VStack>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    )
  }

  // User submitted a code but it was invalid or no trips are available
  // Determine the appropriate error message based on validation status
  let errorMessage: string
  let heading: string

  if (accessCodeValid) {
    // Access code is valid but no trips are available
    heading = "No Trips Available"
    errorMessage = "Your access code is valid, but there are currently no trips available for booking. Please check back later or contact support."
  } else if (accessCodeValidation) {
    // Access code validation failed
    heading = "Access Denied"
    errorMessage = accessCodeValidation.message || "The access code you entered is not valid."
  } else {
    // No validation result yet or no trips available
    heading = "No Trips Available"
    errorMessage = "No trips are currently available for booking."
  }

  return (
    <Container maxW="container.md" py={16}>
      <Card.Root>
        <Card.Body>
          <VStack gap={6} textAlign="center">
            <Heading size="lg">{heading}</Heading>
            <Text>{errorMessage}</Text>
            <Box w="100%" maxW="400px">
              <VStack gap={4}>
                <Input
                  placeholder="Enter access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={handleKeyPress}
                  size="lg"
                  textAlign="center"
                />
                <Button
                  colorPalette="blue"
                  size="lg"
                  onClick={handleSubmitCode}
                  w="100%"
                >
                  Try Again
                </Button>
              </VStack>
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}

export default AccessGate
