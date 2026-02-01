import {
  Box,
  Link,
  Button,
  HStack,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCents } from "@/utils"

interface CustomerInfo {
  first_name: string
  last_name: string
  email: string
  phone: string
  special_requests?: string
  billing_address?: string
  launch_updates_pref: boolean
  terms_accepted: boolean
}

interface BookingStepData {
  selectedItems: any[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  tip: number
  total: number
  customerInfo: CustomerInfo
}

interface Step3CustomerInfoProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
  onBack: () => void
}

const Step3CustomerInfo = ({
  bookingData,
  updateBookingData,
  onNext,
  onBack,
}: Step3CustomerInfoProps) => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    first_name: bookingData.customerInfo?.first_name || "",
    last_name: bookingData.customerInfo?.last_name || "",
    email: bookingData.customerInfo?.email || "",
    phone: bookingData.customerInfo?.phone || "",
    special_requests: bookingData.customerInfo?.special_requests || "",
    billing_address: bookingData.customerInfo?.billing_address || "",
    launch_updates_pref: bookingData.customerInfo?.launch_updates_pref || false,
    terms_accepted: bookingData.customerInfo?.terms_accepted || false,
  })

  const updateCustomerInfo = (
    field: keyof CustomerInfo,
    value: string | boolean,
  ) => {
    const updatedInfo = { ...customerInfo, [field]: value }
    setCustomerInfo(updatedInfo)
    updateBookingData({ customerInfo: updatedInfo })
  }

  const isFormValid = () => {
    return (
      customerInfo.first_name.trim() !== "" &&
      customerInfo.last_name.trim() !== "" &&
      customerInfo.email.trim() !== "" &&
      customerInfo.phone.trim() !== "" &&
      customerInfo.billing_address?.trim() !== "" &&
      customerInfo.terms_accepted
    )
  }

  const handleNext = () => {
    if (isFormValid()) {
      onNext()
    }
  }

  return (
    <Box>
      <Heading size="lg" mb={6}>
        Your Information
      </Heading>

      <HStack align="start" gap={6}>
        {/* Left Column - Customer Information */}
        <VStack gap={4} align="stretch" flex={1}>
          <Box>
            <Heading size="sm" mb={4}>
              Contact Information
            </Heading>
            <VStack gap={4} align="stretch">
              <HStack gap={4}>
                <Box flex={1}>
                  <Text fontWeight="medium" mb={2}>
                    First Name *
                  </Text>
                  <Input
                    placeholder="Enter your first name"
                    value={customerInfo.first_name}
                    onChange={(e) =>
                      updateCustomerInfo("first_name", e.target.value)
                    }
                    required
                    borderColor={"border.accent"}
                  />
                </Box>
                <Box flex={1}>
                  <Text fontWeight="medium" mb={2}>
                    Last Name *
                  </Text>
                  <Input
                    placeholder="Enter your last name"
                    value={customerInfo.last_name}
                    onChange={(e) =>
                      updateCustomerInfo("last_name", e.target.value)
                    }
                    required
                    borderColor={"border.accent"}
                  />
                </Box>
              </HStack>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Email Address *
                </Text>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={customerInfo.email}
                  onChange={(e) => updateCustomerInfo("email", e.target.value)}
                  required
                  borderColor={"border.accent"}
                />
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Phone Number *
                </Text>
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={customerInfo.phone}
                  onChange={(e) => updateCustomerInfo("phone", e.target.value)}
                  required
                  borderColor={"border.accent"}
                />
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>
                  Billing Address *
                </Text>
                <Input
                  placeholder="Enter your billing address"
                  value={customerInfo.billing_address || ""}
                  onChange={(e) =>
                    updateCustomerInfo("billing_address", e.target.value)
                  }
                  required
                  borderColor={"border.accent"}
                />
              </Box>
            </VStack>
          </Box>

          <Box>
            <Heading size="sm" mb={4}>
              Special Requests
            </Heading>
            <Textarea
              placeholder="Any special requests or accommodations needed..."
              value={customerInfo.special_requests || ""}
              onChange={(e) =>
                updateCustomerInfo("special_requests", e.target.value)
              }
              rows={4}
              borderColor={"border.accent"}
            />
          </Box>

          <Box>
            <VStack gap={4} align="stretch">
              <Checkbox
                borderColor="border.accent"
                checked={customerInfo.launch_updates_pref}
                onCheckedChange={({ checked }) =>
                  updateCustomerInfo("launch_updates_pref", checked === true)
                }
              >
                Send me launch updates and schedule changes
              </Checkbox>

              <Checkbox
                borderColor="border.accent"
                checked={customerInfo.terms_accepted}
                inputProps={{ required: true }}
                onCheckedChange={({ checked }) =>
                  updateCustomerInfo("terms_accepted", checked === true)
                }
              >
                I agree to the terms and conditions *
              </Checkbox>

              <Text fontSize="sm" color="dark.text.secondary">
                By checking this box, you agree to our booking&nbsp;
                <Link href="https://www.star-fleet.tours/details" target="_blank">terms and conditions</Link>&nbsp;
                and&nbsp;
                <Link href="https://www.star-fleet.tours/current" target="_blank">scrub policy</Link>&nbsp;
                and acknowledge that you will receive booking confirmations and updates via email.
              </Text>
            </VStack>
          </Box>
        </VStack>

        {/* Right Column - Booking Summary */}
        <VStack gap={4} align="stretch" flex={1}>
          <Box p={6} border="1px" borderColor="gray.200" borderRadius="md">
            <Heading size="sm" mb={4}>
              Booking Summary
            </Heading>
            <VStack
              gap={3}
              align="stretch"
              p={3}
              bg={"bg.accent"}
              borderRadius="md"
            >
              <HStack justify="space-between">
                <Text fontWeight="bold">Selected Items:</Text>
                <Text fontWeight="medium">
                  {bookingData.selectedItems.length} items
                </Text>
              </HStack>

              <HStack justify="space-between">
                <Text fontWeight="bold">Subtotal:</Text>
                <Text fontWeight="medium">
                  ${formatCents(bookingData.subtotal)}
                </Text>
              </HStack>

              {bookingData.discount_amount > 0 && (
                <HStack justify="space-between">
                  <Text fontWeight="bold">Discount:</Text>
                  <Text fontWeight="medium">
                    -${formatCents(bookingData.discount_amount)}
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between">
                <Text fontWeight="bold">Tax:</Text>
                <Text fontWeight="medium">
                  ${formatCents(bookingData.tax_amount)}
                </Text>
              </HStack>

              {bookingData.tip > 0 && (
                <HStack justify="space-between">
                  <Text fontWeight="bold">Tip:</Text>
                  <Text fontWeight="medium">${formatCents(bookingData.tip)}</Text>
                </HStack>
              )}

              <HStack
                justify="space-between"
                pt={2}
                borderTop="1px"
                borderColor="gray.200"
              >
                <Text fontWeight="bold" fontSize="lg">
                  Total:
                </Text>
                <Text fontWeight="bold" fontSize="lg">
                  ${formatCents(bookingData.total)}
                </Text>
              </HStack>
            </VStack>
          </Box>
        </VStack>
      </HStack>

      {/* Navigation */}
      <HStack justify="space-between" mt={8}>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          colorScheme="blue"
          onClick={handleNext}
          disabled={!isFormValid()}
        >
          Continue to Review
        </Button>
      </HStack>
    </Box>
  )
}

export default Step3CustomerInfo
