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
import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { type ApiError, DiscountCodesService, TripsService } from "@/client"

interface AccessGateProps {
  accessCode?: string
  /** When set (e.g. from URL ?trip=), fetch this trip by ID; if valid (e.g. unlisted), grant access even when listed trips is empty */
  directTripId?: string
  onAccessGranted: (
    accessCode: string | null,
    discountCodeId: string | null,
  ) => void
  /** accessCodeValue, discountCodeId (for early_bird missions) */
  children: (
    accessCodeValue: string | null,
    discountCodeId: string | null,
  ) => React.ReactNode
}

/**
 * AccessGate component that controls access to the booking form based on
 * trip booking_mode and public trip list.
 *
 * - If trips are available: shows children
 * - If all bookable trips require a code (all_trips_require_access_code): shows code entry form
 * - Otherwise: shows "not available" or error
 */
const AccessGate = ({
  accessCode: initialAccessCode,
  directTripId,
  onAccessGranted,
  children,
}: AccessGateProps) => {
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

  // Fetch public trips (filtered by trip booking_mode and optional access code)
  const {
    data: tripsData,
    isLoading: isLoadingTrips,
    error: tripsError,
  } = useQuery({
    queryKey: ["public-trips", submittedCode, directTripId],
    queryFn: () =>
      TripsService.readPublicTrips({
        limit: 100,
        accessCode: submittedCode || undefined,
        includeTripId: directTripId || undefined,
      }),
  })

  // Direct-link trip (e.g. unlisted): fetch single trip by ID when URL has ?trip=; grant access only if valid (active, not departed, launch not past)
  const {
    data: directTripData,
    isLoading: isLoadingDirectTrip,
    isFetching: isFetchingDirectTrip,
    isError: isDirectTripError,
    error: directTripError,
  } = useQuery({
    queryKey: ["public-trip", directTripId, submittedCode],
    queryFn: () =>
      TripsService.readPublicTrip({
        tripId: directTripId!,
        accessCode: submittedCode || undefined,
      }),
    enabled: !!directTripId,
    retry: (_, error) => {
      const status = (error as ApiError)?.status
      return status !== 403 && status !== 404
    },
  })

  // Validate access code if provided
  const { data: accessCodeValidation, isLoading: isValidatingCode } = useQuery({
    queryKey: ["validate-access-code", submittedCode],
    queryFn: () =>
      DiscountCodesService.validateAccessCode({
        code: submittedCode,
      }),
    enabled: !!submittedCode,
  })

  // Only treat direct-link trip as valid when fetch succeeded; do not use it if unavailable by date/launch (API returns 404)
  const hasTrips =
    (tripsData?.data?.length ?? 0) > 0 ||
    (!!directTripId && !!directTripData && !isDirectTripError)
  const allTripsRequireAccessCode =
    tripsData?.all_trips_require_access_code === true
  const accessCodeValid = accessCodeValidation?.valid === true

  // Notify parent when access is granted (effect only, never during render; must run on every render to satisfy Rules of Hooks)
  useEffect(() => {
    if (!hasTrips) return
    if (accessCodeValid && accessCodeValidation?.discount_code) {
      onAccessGranted(submittedCode, accessCodeValidation.discount_code.id)
    } else {
      onAccessGranted(null, null)
    }
  }, [
    hasTrips,
    accessCodeValid,
    accessCodeValidation?.discount_code,
    submittedCode,
    onAccessGranted,
  ])

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

  // Loading state (include direct-trip fetch when URL has ?trip= and no listed trips yet)
  // When directTripId is set and no listed trips, wait for direct trip query to settle (loading or fetching)
  const waitingForDirectTrip =
    !!directTripId &&
    !(tripsData?.data?.length ?? 0) &&
    (isLoadingDirectTrip || isFetchingDirectTrip)
  if (
    isLoadingTrips ||
    waitingForDirectTrip ||
    (submittedCode && isValidatingCode)
  ) {
    return (
      <Container maxW="container.md" py={16}>
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Checking availability...</Text>
        </VStack>
      </Container>
    )
  }

  // Error state: generic trips list failure
  if (tripsError) {
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={4} textAlign="center">
              <Heading size="lg">Unable to Load Trips</Heading>
              <Text>
                We encountered an error while loading available trips. Please
                try again later.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    )
  }

  // Direct-link trip 403: private (not yet available) vs early_bird (access code required)
  const directTrip403 =
    directTripId &&
    isDirectTripError &&
    !isLoadingDirectTrip &&
    (directTripError as ApiError)?.status === 403
  if (directTrip403) {
    const errBody = (directTripError as ApiError)?.body as { detail?: string } | undefined
    const detail = typeof errBody?.detail === "string" ? errBody.detail : ""
    const isPrivateNotYetAvailable = detail.includes("not yet available")
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={6} textAlign="center">
              <Heading size="lg">
                {isPrivateNotYetAvailable ? "Tickets Not Yet Available" : "Access Code Required"}
              </Heading>
              <Text>
                {isPrivateNotYetAvailable
                  ? detail || "Tickets are not yet available for this trip."
                  : "This trip requires an access code to book. If you have one, enter it below to continue."}
              </Text>
              {!isPrivateNotYetAvailable && (
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
              )}
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    )
  }

  // Direct-link trip 404: not found (invalid ID) vs departed/unavailable
  if (directTripId && isDirectTripError && !isLoadingDirectTrip) {
    const errBody = (directTripError as ApiError)?.body as { detail?: string } | undefined
    const detail = typeof errBody?.detail === "string" ? errBody.detail : ""
    const isNotFound = (directTripError as ApiError)?.status === 404 && detail.toLowerCase().includes("not found")
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={4} textAlign="center">
              <Heading size="lg">
                {isNotFound ? "Trip Not Found" : "This Trip Is Not Available"}
              </Heading>
              <Text>
                {isNotFound
                  ? "No trip exists with the given ID. The link may be incorrect or outdated."
                  : "This trip is no longer available for booking. It may have already departed, or the launch for this mission may have already occurred."}
              </Text>
              {isNotFound && (
                <Button
                  asChild
                  colorPalette="blue"
                >
                  <Link to="/book" search={{}}>View available trips</Link>
                </Button>
              )}
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
    return (
      <>{children(accessCodeValid ? submittedCode : null, discountCodeId)}</>
    )
  }

  // No trips available - show code prompt only when ALL bookable trips require a code
  if (allTripsRequireAccessCode && !submittedCode) {
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={6} textAlign="center">
              <Heading size="lg">Early Access Required</Heading>
              <Text>
                Tickets are not yet available to the public. If you have an
                early access code, enter it below to continue.
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

  // No trips and not all require code: show simple "no trips" (no code form)
  if (!hasTrips && !allTripsRequireAccessCode) {
    return (
      <Container maxW="container.md" py={16}>
        <Card.Root>
          <Card.Body>
            <VStack gap={4} textAlign="center">
              <Heading size="lg">No Trips Available</Heading>
              <Text>No trips are currently available for booking.</Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Container>
    )
  }

  // allTripsRequireAccessCode and user submitted a code: invalid or still no trips
  let errorMessage: string
  let heading: string

  if (accessCodeValid) {
    // Access code is valid but no trips are available
    heading = "No Trips Available"
    errorMessage =
      "Your access code is valid, but there are currently no trips available for booking. Please check back later or contact Star Fleet at FleetCommand@Star-Fleet.Tours."
  } else if (accessCodeValidation) {
    // Access code validation failed
    heading = "Access Denied"
    errorMessage =
      accessCodeValidation.message ||
      "The access code you entered is not valid."
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
