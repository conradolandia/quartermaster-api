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
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"

import type { BookingPublic } from "@/client"
import Logo from "/assets/images/qm-logo.svg"

// Types for the booking flow
export interface BookingStepData {
  // Step 1: Launch and Trip Selection
  selectedLaunchId: string
  selectedTripId: string
  selectedBoatId: string
  /** Remaining passenger capacity for the selected boat (from API). */
  boatRemainingCapacity: number | null

  // Step 2: Item Selection
  selectedItems: Array<{
    trip_id: string
    item_type: string
    quantity: number
    price_per_unit: number
    trip_merchandise_id?: string
    variant_option?: string
  }>

  // Step 3: Customer Information
  customerInfo: {
    first_name: string
    last_name: string
    email: string
    phone: string
    special_requests?: string
    billing_address?: string
    launch_updates_pref: boolean
    terms_accepted: boolean
  }

  // Pricing
  subtotal: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  tip: number
  total: number
  discount_code_id: string | null
  discount_code?: string
}

/** Map API booking (e.g. from getBookingByConfirmationCode) to form step data for pre-fill when resuming. */
function bookingPublicToStepData(booking: BookingPublic): BookingStepData {
  const nameParts = (booking.user_name || "").trim().split(/\s+/)
  const first_name = nameParts[0] ?? ""
  const last_name = nameParts.slice(1).join(" ") ?? ""
  const items = booking.items ?? []
  const firstItem = items[0]
  const subtotal = booking.subtotal ?? 0
  const tax_rate =
    subtotal > 0 && (booking.tax_amount ?? 0) > 0
      ? Math.round(((booking.tax_amount ?? 0) / subtotal) * 100)
      : 0

  return {
    selectedLaunchId: "",
    selectedTripId: firstItem?.trip_id ?? "",
    selectedBoatId: firstItem?.boat_id ?? "",
    boatRemainingCapacity: null,
    selectedItems: items.map((item) => ({
      trip_id: item.trip_id,
      item_type: item.item_type,
      quantity: item.quantity,
      price_per_unit: item.price_per_unit,
      trip_merchandise_id: item.trip_merchandise_id ?? undefined,
      variant_option: item.variant_option ?? undefined,
    })),
    customerInfo: {
      first_name,
      last_name,
      email: booking.user_email ?? "",
      phone: booking.user_phone ?? "",
      special_requests: booking.special_requests ?? "",
      billing_address: booking.billing_address ?? "",
      launch_updates_pref: booking.launch_updates_pref ?? false,
      terms_accepted: true,
    },
    subtotal,
    discount_amount: booking.discount_amount ?? 0,
    tax_rate,
    tax_amount: booking.tax_amount ?? 0,
    tip: booking.tip_amount ?? 0,
    total: booking.total_amount ?? 0,
    discount_code_id: booking.discount_code_id ?? null,
    discount_code: booking.discount_code?.code,
  }
}

const STEPS = [
  {
    id: 1,
    title: "Select Mission & Trip",
    description: "Choose your mission, trip and boat",
  },
  {
    id: 2,
    title: "Select Items",
    description: "Choose tickets and merchandise",
  },
  { id: 3, title: "Your Information", description: "Enter your details" },
  { id: 4, title: "Review & Pay", description: "Review and complete booking" },
]

// Import step components
import Step1TripSelection from "./Steps/Step1TripSelection"
import Step2ItemSelection from "./Steps/Step2ItemSelection"
import Step3CustomerInfo from "./Steps/Step3CustomerInfo"
import Step4Review from "./Steps/Step4Review"

interface PublicBookingFormProps {
  initialDiscountCodeId?: string | null
  accessCodeDiscountCodeId?: string | null
  accessCode?: string | null
}

export type BookingResult = { booking: any; paymentData: any }

const PublicBookingForm = ({
  initialDiscountCodeId,
  accessCodeDiscountCodeId,
  accessCode,
}: PublicBookingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1)
  const search = useSearch({ from: "/book" })
  const navigate = useNavigate({ from: "/book" })
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  /** Survives Step4Review remounts (e.g. Strict Mode); prevents double booking create. */
  const createBookingStartedRef = useRef(false)
  /** When true, don't auto-jump to step 4 when URL has code (user clicked Back from step 4). */
  const didGoBackFromStep4Ref = useRef(false)
  /** Code we already pre-filled form for; don't overwrite form when re-loading after user went Back. */
  const hydratedForCodeRef = useRef<string | null>(null)
  const [bookingData, setBookingData] = useState<BookingStepData>({
    // Step 1: Launch and Trip Selection
    selectedLaunchId: "",
    selectedTripId: "",
    selectedBoatId: "",
    boatRemainingCapacity: null,

    // Step 2: Item Selection
    selectedItems: [],

    // Step 3: Customer Information
    customerInfo: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      special_requests: "",
      billing_address: "",
      launch_updates_pref: false,
      terms_accepted: false,
    },

    // Pricing
    subtotal: 0,
    discount_amount: 0,
    tax_rate: 0,
    tax_amount: 0,
    tip: 0,
    total: 0,
    discount_code_id: null,
  })

  const updateBookingData = useCallback((updates: Partial<BookingStepData>) => {
    setBookingData((prev) => ({
      ...prev,
      ...updates,
    }))
  }, [])

  // Handle URL parameters and initial discount code from AccessGate
  useEffect(() => {
    if (search.discount) {
      // Pre-fill discount code from URL parameter
      setBookingData((prev) => ({
        ...prev,
        discount_code: search.discount,
      }))
    }
  }, [search.discount])

  // Apply launch/trip/boat from URL so the form opens with a specific selection
  useEffect(() => {
    const launch = search.launch ?? ""
    const trip = search.trip ?? ""
    const boat = search.boat ?? ""
    if (!launch && !trip && !boat) return
    setBookingData((prev) => ({
      ...prev,
      ...(launch && { selectedLaunchId: launch }),
      ...(trip && { selectedTripId: trip }),
      ...(boat && { selectedBoatId: boat }),
    }))
  }, [search.launch, search.trip, search.boat])

  // Sync selected launch/trip/boat to URL so the link stays shareable
  useEffect(() => {
    const urlLaunch = search.launch ?? ""
    const urlTrip = search.trip ?? ""
    const urlBoat = search.boat ?? ""
    const dataLaunch = bookingData.selectedLaunchId ?? ""
    const dataTrip = bookingData.selectedTripId ?? ""
    const dataBoat = bookingData.selectedBoatId ?? ""
    if (
      dataLaunch === urlLaunch &&
      dataTrip === urlTrip &&
      dataBoat === urlBoat
    )
      return
    navigate({
      search: (prev: {
        discount?: string
        access?: string
        code?: string
        launch?: string
        trip?: string
        boat?: string
      }) => ({
        ...prev,
        launch: dataLaunch || undefined,
        trip: dataTrip || undefined,
        boat: dataBoat || undefined,
      }),
    })
  }, [
    bookingData.selectedLaunchId,
    bookingData.selectedTripId,
    bookingData.selectedBoatId,
    search.launch,
    search.trip,
    search.boat,
    navigate,
  ])

  // When user applies a new discount code in Step2, sync it to the URL so the link stays shareable
  useEffect(() => {
    const urlDiscount = search.discount ?? ""
    const dataDiscount = bookingData.discount_code ?? ""
    if (dataDiscount !== urlDiscount) {
      navigate({
        search: (prev: {
          discount?: string
          access?: string
          code?: string
        }) => ({
          ...prev,
          discount: dataDiscount || undefined,
        }),
      })
    }
  }, [bookingData.discount_code, search.discount, navigate])

  // Apply discount code ID from AccessGate (access code validation)
  useEffect(() => {
    if (initialDiscountCodeId) {
      setBookingData((prev) => ({
        ...prev,
        discount_code_id: initialDiscountCodeId,
      }))
    }
  }, [initialDiscountCodeId])

  // When access=CODE is used and gate gave us the code ID, treat that code as the discount too so Step2 validates and applies it
  useEffect(() => {
    if (accessCode && initialDiscountCodeId) {
      setBookingData((prev) =>
        prev.discount_code ? prev : { ...prev, discount_code: accessCode }
      )
    }
  }, [accessCode, initialDiscountCodeId])

  // When URL has a confirmation code, show step 4 so resume flow runs there (unless user went Back from step 4)
  useEffect(() => {
    if (search.code && !didGoBackFromStep4Ref.current) {
      setCurrentStep(4)
    }
    if (!search.code) {
      didGoBackFromStep4Ref.current = false
      hydratedForCodeRef.current = null
    }
  }, [search.code])

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
    createBookingStartedRef.current = false
    prevStep()
    // Keep code in URL so returning to step 4 resumes the same booking
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
            onBookingReady={(result) => {
              setBookingResult(result)
              // Mark that we have shown this booking so returning from step 3 does not overwrite edits
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
      backgroundAttachment="fixed"
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
            py={6}
            bg="dark.bg.primary"
            color="white"
          >
            <Container maxW="container.lg">
              <Flex justify="space-between" align="center">
                <Heading fontFamily="logo" size="3xl" fontWeight="400">
                  Star<Span color="dark.accent.primary">✦</Span>Fleet Tours
                </Heading>
                <VStack gap={1} align="right" textAlign="right">
                  <Heading size="2xl">Book Your Star Fleet Experience</Heading>
                  <Text
                    fontSize="md"
                    color="whiteAlpha.800"
                    textAlign="right"
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
