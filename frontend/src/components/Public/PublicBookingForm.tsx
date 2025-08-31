import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react"
import { useState } from "react"

// Types for the booking flow
export interface BookingStepData {
  // Step 1: Trip Selection
  selectedTripId: string
  selectedBoatId: string

  // Step 2: Item Selection
  selectedItems: Array<{
    trip_id: string
    item_type: string
    quantity: number
    price_per_unit: number
    trip_merchandise_id?: string
  }>

  // Step 3: Customer Information
  customerInfo: {
    first_name: string
    last_name: string
    email: string
    phone: string
    special_requests?: string
    billing_address?: string
    launch_updates_pref?: boolean
    terms_accepted: boolean
  }

  // Pricing
  subtotal: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  tip: number
  total: number
}

const STEPS = [
  { id: 1, title: "Select Trip", description: "Choose your launch and trip" },
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

const PublicBookingForm = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [bookingData, setBookingData] = useState<BookingStepData>({
    // Step 1: Trip Selection
    selectedTripId: "",
    selectedBoatId: "",

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
  })

  const updateBookingData = (updates: Partial<BookingStepData>) => {
    setBookingData((prev) => ({
      ...prev,
      ...updates,
    }))
  }

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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1TripSelection
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onNext={nextStep}
          />
        )
      case 2:
        return (
          <Step2ItemSelection
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onNext={nextStep}
            onBack={prevStep}
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
        return <Step4Review bookingData={bookingData} onBack={prevStep} />
      default:
        return <Text>Invalid step</Text>
    }
  }

  return (
    <Container maxW="container.lg" py={8}>
      <VStack gap={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading size="lg" mb={2}>
            Book Your Rocket Launch Experience
          </Heading>
          <Text color="gray.600">
            Select your preferred launch and secure your spot
          </Text>
        </Box>

        {/* Progress Bar */}
        <Box>
          <Box bg="gray.200" h="8px" borderRadius="md" overflow="hidden">
            <Box
              bg="blue.500"
              h="100%"
              w={`${(currentStep / STEPS.length) * 100}%`}
              transition="width 0.3s ease"
            />
          </Box>
          <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
            Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
          </Text>
        </Box>

        {/* Step Content */}
        <Box>{renderCurrentStep()}</Box>

        {/* Navigation is now handled by individual step components */}
      </VStack>
    </Container>
  )
}

export default PublicBookingForm
