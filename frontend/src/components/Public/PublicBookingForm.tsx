import {
  Box,
  Container,
  Flex,
  Heading,
  Image,
  Spinner,
  Span,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { useCallback, useRef, useState } from "react"

import Logo from "/assets/images/qm-logo.svg"

import {
  type BookingResult,
  type BookingStepData,
  INITIAL_BOOKING_DATA,
  STEPS,
  bookingPublicToStepData,
} from "./bookingTypes"
import { useBookingUrlSync } from "./useBookingUrlSync"

import Step1TripSelection from "./Steps/Step1TripSelection"
import Step2ItemSelection from "./Steps/Step2ItemSelection"
import Step3CustomerInfo from "./Steps/Step3CustomerInfo"
import Step4Review from "./Steps/Step4Review"

interface PublicBookingFormProps {
  initialDiscountCodeId?: string | null
  accessCodeDiscountCodeId?: string | null
  accessCode?: string | null
}

const PublicBookingForm = ({
  initialDiscountCodeId,
  accessCodeDiscountCodeId,
  accessCode,
}: PublicBookingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [createError, setCreateError] = useState(false)
  /** Survives Step4Review remounts (e.g. Strict Mode); prevents double booking create. */
  const createBookingStartedRef = useRef(false)
  /** When true, don't auto-jump to step 4 when URL has code (user clicked Back from step 4). */
  const didGoBackFromStep4Ref = useRef(false)
  /** Code we already pre-filled form for; don't overwrite form when re-loading after user went Back. */
  const hydratedForCodeRef = useRef<string | null>(null)
  const [bookingData, setBookingData] =
    useState<BookingStepData>(INITIAL_BOOKING_DATA)
  /** Step 1: trips for selected mission are still loading (header + trip dropdown UX). */
  const [step1TripOptionsLoading, setStep1TripOptionsLoading] = useState(false)

  const updateBookingData = useCallback((updates: Partial<BookingStepData>) => {
    setBookingData((prev) => ({
      ...prev,
      ...updates,
    }))
  }, [])

  const { search } = useBookingUrlSync({
    bookingData,
    setBookingData,
    setCurrentStep,
    initialDiscountCodeId,
    accessCodeDiscountCodeId,
    accessCode,
    didGoBackFromStep4Ref,
    hydratedForCodeRef,
  })

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onBackFromStep4 = () => {
    didGoBackFromStep4Ref.current = true
    setBookingResult(null)
    setCreateError(false)
    createBookingStartedRef.current = false
    prevStep()
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1TripSelection
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onNext={nextStep}
            accessCode={accessCode}
            onTripOptionsLoadingChange={setStep1TripOptionsLoading}
          />
        )
      case 2:
        return (
          <Step2ItemSelection
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onNext={nextStep}
            onBack={prevStep}
            accessCode={accessCode}
          />
        )
      case 3:
        return (
          <Step3CustomerInfo
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 4:
        return (
          <Step4Review
            bookingData={bookingData}
            onBack={onBackFromStep4}
            bookingResult={bookingResult}
            createError={createError}
            onCreateError={() => setCreateError(true)}
            onBookingReady={(result) => {
              setBookingResult(result)
              if (result?.booking?.confirmation_code) {
                hydratedForCodeRef.current = result.booking.confirmation_code
              }
            }}
            onResumeBookingLoaded={(booking) => {
              setBookingData(bookingPublicToStepData(booking))
              hydratedForCodeRef.current = booking.confirmation_code
            }}
            skipHydrateForm={Boolean(
              search.code && hydratedForCodeRef.current === search.code,
            )}
            urlCode={search.code}
            createBookingStartedRef={createBookingStartedRef}
            accessCodeDiscountCodeId={accessCodeDiscountCodeId}
          />
        )
      default:
        return <Text>Invalid step</Text>
    }
  }

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
      {/* Dark overlay for readability */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.600"
        pointerEvents="none"
        zIndex={0}
      />
      <Box position="relative" zIndex={1}>
        {/* Header */}
        <Box position="sticky" top={0} zIndex={10}>
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
                    _hover={{ opacity: 0.85 }}
                    transition="opacity 0.15s"
                  >
                    Star<Span color="dark.accent.primary">✦</Span>Fleet Tours
                  </Heading>
                </Link>
                <VStack
                  gap={1}
                  align={{ base: "stretch", md: "flex-end" }}
                  textAlign={{ base: "left", md: "right" }}
                >
                  <Flex
                    align="center"
                    justify={{ base: "flex-start", md: "flex-end" }}
                    gap={3}
                    flexWrap="wrap"
                  >
                    {currentStep === 1 && step1TripOptionsLoading && (
                      <Spinner
                        size="sm"
                        color="dark.accent.primary"
                        aria-label="Loading trip options"
                      />
                    )}
                    <Heading size={{ base: "lg", md: "2xl" }}>
                      Book Your Star Fleet Experience
                    </Heading>
                  </Flex>
                  <Text
                    fontSize={{ base: "sm", md: "md" }}
                    color="whiteAlpha.800"
                    fontWeight="500"
                  >
                    Step {currentStep} of {STEPS.length}:{" "}
                    <Span color="dark.accent.primary">
                      {STEPS[currentStep - 1].title}
                    </Span>{" "}
                    <Span fontWeight="300">
                      ({STEPS[currentStep - 1].description})
                    </Span>
                  </Text>
                </VStack>
              </Flex>
            </Container>
          </Box>

          {/* Progress bar */}
          <Box bg="whiteAlpha.300" h="8px" overflow="hidden">
            <Box
              bg="dark.accent.primary"
              h="100%"
              w={`${(currentStep / STEPS.length) * 100}%`}
              transition="width 0.3s ease"
            />
          </Box>
        </Box>

        {/* Step content */}
        <Container maxW="container.lg" mx="auto" py={8}>
          <Box
            bg="dark.bg.secondary"
            borderRadius="lg"
            boxShadow="lg"
            p={{ base: 4, md: 8 }}
          >
            {renderCurrentStep()}
          </Box>
        </Container>

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

export default PublicBookingForm
