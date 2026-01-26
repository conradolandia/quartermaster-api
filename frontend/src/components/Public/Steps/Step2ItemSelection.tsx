import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Heading,
  IconButton,
  Input,
  NumberInput,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiAlertCircle, FiTrash2 } from "react-icons/fi"

import {
  DiscountCodesService,
  JurisdictionsService,
  LaunchesService,
  MissionsService,
  type TripMerchandisePublic,
  TripMerchandiseService,
  type TripPricingPublic,
  TripPricingService,
  TripsService,
} from "@/client"

import type { BookingStepData } from "../PublicBookingForm"

interface Step2ItemSelectionProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
  onBack: () => void
}

const Step2ItemSelection = ({
  bookingData,
  updateBookingData,
  onNext,
  onBack,
}: Step2ItemSelectionProps) => {
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [tip, setTip] = useState<number>(0)
  const [discountCode, setDiscountCode] = useState<string>(bookingData.discount_code || "")
  const [discountCodeError, setDiscountCodeError] = useState<string>("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null)

  // Fetch trip details to get jurisdiction for tax rate (using public endpoint)
  const { data: tripData } = useQuery({
    queryKey: ["public-trip-details", bookingData.selectedTripId],
    queryFn: () =>
      TripsService.readPublicTrip({ tripId: bookingData.selectedTripId }),
    enabled: !!bookingData.selectedTripId,
  })

  // Fetch mission details (using public endpoint)
  const { data: missionData } = useQuery({
    queryKey: ["public-mission-details", tripData?.mission_id],
    queryFn: () =>
      MissionsService.readPublicMissions({ limit: 100 }),
    enabled: !!tripData?.mission_id,
    select: (data) => data.data.find((m) => m.id === tripData?.mission_id),
  })

  // Fetch launch details (using public endpoint)
  const { data: launchData } = useQuery({
    queryKey: ["public-launch-details", missionData?.launch_id],
    queryFn: () =>
      LaunchesService.readPublicLaunch({ launchId: missionData!.launch_id }),
    enabled: !!missionData?.launch_id,
  })

  // Fetch jurisdiction for tax rate
  const { data: jurisdictionsData } = useQuery({
    queryKey: ["jurisdictions-by-location", launchData?.location_id],
    queryFn: () =>
      JurisdictionsService.readJurisdictions({
        locationId: launchData!.location_id,
        limit: 100,
      }),
    enabled: !!launchData?.location_id,
  })

  // Get tax rate from jurisdiction (convert from decimal to percentage)
  const taxRatePercent = jurisdictionsData?.data?.[0]?.sales_tax_rate
    ? jurisdictionsData.data[0].sales_tax_rate * 100
    : 0

  // Check if jurisdiction is missing when we have location data
  const jurisdictionMissing = !!launchData?.location_id && (!jurisdictionsData?.data || jurisdictionsData.data.length === 0)

  // Auto-validate discount code if it was pre-filled from URL
  useEffect(() => {
    if (bookingData.discount_code && bookingData.discount_code !== discountCode) {
      setDiscountCode(bookingData.discount_code)
      validateDiscountCode(bookingData.discount_code)
    }
  }, [bookingData.discount_code])

  // Validate discount code
  const validateDiscountCode = async (code: string) => {
    if (!code.trim()) {
      setDiscountCodeError("")
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
      return
    }

    try {
      const subtotal = bookingData.selectedItems.reduce((sum, item) => {
        return sum + item.quantity * item.price_per_unit
      }, 0)

      const discountCodeData = await DiscountCodesService.validateDiscountCode({
        code: code.trim(),
        subtotal: subtotal,
      })

      setAppliedDiscountCode(discountCodeData)
      setDiscountCodeError("")

      // Calculate discount amount based on code type
      let calculatedDiscount = 0
      if (discountCodeData.discount_type === "percentage") {
        calculatedDiscount = (subtotal * discountCodeData.discount_value) / 100
        if (discountCodeData.max_discount_amount) {
          calculatedDiscount = Math.min(calculatedDiscount, discountCodeData.max_discount_amount)
        }
      } else {
        calculatedDiscount = discountCodeData.discount_value
      }

      setDiscountAmount(calculatedDiscount)
    } catch (error: any) {
      setDiscountCodeError(error.response?.data?.detail || "Invalid discount code")
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
    }
  }

  // Fetch trip pricing (using public endpoint)
  const { data: tripPricing } = useQuery({
    queryKey: ["public-trip-pricing", bookingData.selectedTripId],
    queryFn: () =>
      TripPricingService.listPublicTripPricing({
        tripId: bookingData.selectedTripId,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  // Fetch trip merchandise (using public endpoint)
  const { data: tripMerchandise } = useQuery({
    queryKey: ["public-trip-merchandise", bookingData.selectedTripId],
    queryFn: () =>
      TripMerchandiseService.listPublicTripMerchandise({
        tripId: bookingData.selectedTripId,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  // Calculate pricing whenever items change
  useEffect(() => {
    const subtotal = bookingData.selectedItems.reduce((sum, item) => {
      return sum + item.price_per_unit * item.quantity
    }, 0)

    const taxAmount = (subtotal - discountAmount) * (taxRatePercent / 100)
    const total = subtotal - discountAmount + taxAmount + tip

    updateBookingData({
      subtotal,
      discount_amount: discountAmount,
      tax_rate: taxRatePercent,
      tax_amount: taxAmount,
      tip,
      total,
      discount_code_id: appliedDiscountCode?.id || null,
    })
  }, [bookingData.selectedItems, discountAmount, taxRatePercent, tip, appliedDiscountCode])

  const addTicket = (ticketType: string, price: number) => {
    const existingItem = bookingData.selectedItems.find(
      (item) => item.item_type === ticketType && !item.trip_merchandise_id,
    )

    if (existingItem) {
      // Increment quantity
      const updatedItems = bookingData.selectedItems.map((item) =>
        item === existingItem ? { ...item, quantity: item.quantity + 1 } : item,
      )
      updateBookingData({ selectedItems: updatedItems })
    } else {
      // Add new item
      const newItem = {
        trip_id: bookingData.selectedTripId,
        item_type: ticketType,
        quantity: 1,
        price_per_unit: price,
      }
      updateBookingData({
        selectedItems: [...bookingData.selectedItems, newItem],
      })
    }
  }

  const addMerchandise = (merchandise: TripMerchandisePublic) => {
    const existingItem = bookingData.selectedItems.find(
      (item) => item.trip_merchandise_id === merchandise.id,
    )

    if (existingItem) {
      // Increment quantity if available
      if (existingItem.quantity < merchandise.quantity_available) {
        const updatedItems = bookingData.selectedItems.map((item) =>
          item === existingItem
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
        updateBookingData({ selectedItems: updatedItems })
      }
    } else {
      // Add new item
      const newItem = {
        trip_id: bookingData.selectedTripId,
        item_type: merchandise.name,
        quantity: 1,
        price_per_unit: merchandise.price,
        trip_merchandise_id: merchandise.id,
      }
      updateBookingData({
        selectedItems: [...bookingData.selectedItems, newItem],
      })
    }
  }

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item
      const updatedItems = bookingData.selectedItems.filter(
        (_, i) => i !== index,
      )
      updateBookingData({ selectedItems: updatedItems })
    } else {
      // Update quantity
      const updatedItems = bookingData.selectedItems.map((item, i) =>
        i === index ? { ...item, quantity: newQuantity } : item,
      )
      updateBookingData({ selectedItems: updatedItems })
    }
  }

  const removeItem = (index: number) => {
    const updatedItems = bookingData.selectedItems.filter((_, i) => i !== index)
    updateBookingData({ selectedItems: updatedItems })
  }

  const canProceed = bookingData.selectedItems.length > 0

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="md" mb={4}>
          Select Tickets & Merchandise
        </Heading>
        <Text color="text.muted" mb={6}>
          Choose your tickets and any merchandise you'd like to purchase.
        </Text>
      </Box>

      {/* Error message if jurisdiction is missing */}
      {jurisdictionMissing && (
        <Card.Root bg="status.error" borderColor="red.500" borderWidth="1px">
          <Card.Body>
            <HStack gap={3}>
              <FiAlertCircle size={24} />
              <Box>
                <Text fontWeight="semibold" mb={1}>
                  Tax Configuration Error
                </Text>
                <Text fontSize="sm">
                  No tax jurisdiction is configured for this location. Please contact support to complete your booking.
                </Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      <HStack align="start" gap={6}>
        {/* Left Column - Selection */}
        <VStack gap={4} align="stretch" flex={1}>
          {/* Ticket Selection */}
          {tripPricing && tripPricing.length > 0 && (
            <Card.Root bg="bg.panel">
              <Card.Body>
                <Heading size="sm" mb={4}>
                  Tickets
                </Heading>
                <VStack gap={3} align="stretch">
                  {tripPricing.map((pricing: TripPricingPublic) => (
                    <HStack key={pricing.id} justify="space-between">
                      <Box>
                        <Text fontWeight="medium">
                          {pricing.ticket_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                        <Text fontSize="sm" color="gray.400">
                          ${pricing.price.toFixed(2)} each
                        </Text>
                      </Box>
                      <Button
                        size="sm"
                        onClick={() =>
                          addTicket(pricing.ticket_type, pricing.price)
                        }
                      >
                        Add
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Merchandise Selection */}
          {tripMerchandise && tripMerchandise.length > 0 && (
            <Card.Root bg="bg.panel">
              <Card.Body>
                <Heading size="sm" mb={4}>
                  Merchandise
                </Heading>
                <VStack gap={3} align="stretch">
                  {tripMerchandise.map((merchandise: TripMerchandisePublic) => (
                    <HStack key={merchandise.id} justify="space-between">
                      <Box flex={1}>
                        <Text fontWeight="medium">{merchandise.name}</Text>
                        {merchandise.description && (
                          <Text fontSize="sm" color="gray.400" lineClamp={2}>
                            {merchandise.description}
                          </Text>
                        )}
                        <HStack gap={2} mt={1}>
                          <Text fontSize="sm" color="gray.400">
                            ${merchandise.price.toFixed(2)} each
                          </Text>
                          <Badge
                            colorPalette={
                              merchandise.quantity_available > 0
                                ? "green"
                                : "red"
                            }
                          >
                            {merchandise.quantity_available} available
                          </Badge>
                        </HStack>
                      </Box>
                      <Button
                        size="sm"
                        colorPalette="blue"
                        disabled={merchandise.quantity_available === 0}
                        onClick={() => addMerchandise(merchandise)}
                      >
                        Add
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}
        </VStack>

        {/* Right Column - Selected Items & Pricing */}
        <VStack gap={4} align="stretch" flex={1}>
          {/* Selected Items */}
          <Card.Root bg="bg.panel">
            <Card.Body>
              <Heading size="sm" mb={4}>
                Selected Items
              </Heading>
              {bookingData.selectedItems.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={4}>
                  No items selected
                </Text>
              ) : (
                <VStack gap={3} align="stretch">
                  {bookingData.selectedItems.map((item, index) => {
                    const merchandise = tripMerchandise?.find(
                      (m) => m.id === item.trip_merchandise_id,
                    )
                    const pricing = tripPricing?.find(
                      (p) => p.ticket_type === item.item_type,
                    )

                    const itemName = merchandise
                      ? merchandise.name
                      : pricing
                        ? pricing.ticket_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())
                        : item.item_type

                    return (
                      <HStack
                        key={index}
                        justify="space-between"
                        px={3}
                        py={2}
                        bg={"bg.accent"}
                        borderRadius="md"
                      >
                        <Box flex={1}>
                          <Text fontWeight="medium">{itemName}</Text>
                          <Text fontSize="sm" color="gray.400">
                            ${item.price_per_unit.toFixed(2)} × {item.quantity}
                          </Text>
                        </Box>
                        <HStack gap={2}>
                          <NumberInput.Root
                            size="sm"
                            min={0}
                            max={
                              merchandise ? merchandise.quantity_available : 999
                            }
                            value={item.quantity.toString()}
                            onValueChange={(details) =>
                              updateItemQuantity(
                                index,
                                Number.parseInt(details.value) || 0,
                              )
                            }
                            w="80px"
                          >
                            <NumberInput.Input />
                            <NumberInput.Control>
                              <NumberInput.IncrementTrigger />
                              <NumberInput.DecrementTrigger />
                            </NumberInput.Control>
                          </NumberInput.Root>
                          <IconButton
                            size="sm"
                            aria-label="Remove item"
                            onClick={() => removeItem(index)}
                            variant="ghost"
                          >
                            <FiTrash2 />
                          </IconButton>
                        </HStack>
                      </HStack>
                    )
                  })}
                </VStack>
              )}
            </Card.Body>
          </Card.Root>

          {/* Pricing Summary */}
          <Card.Root bg="bg.panel">
            <Card.Body>
              <Heading size="sm" mb={4}>
                Pricing Summary
              </Heading>
              <VStack gap={3} align="stretch">
                <HStack justify="space-between">
                  <Text>Subtotal:</Text>
                  <Text fontWeight="semibold">
                    ${bookingData.subtotal.toFixed(2)}
                  </Text>
                </HStack>

                <VStack align="stretch" gap={2}>
                  <HStack justify="space-between">
                    <Text>Discount Code:</Text>
                    <HStack gap={2}>
                      <Input
                        size="sm"
                        placeholder="Enter code"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        onBlur={() => validateDiscountCode(discountCode)}
                        w="120px"
                        borderColor={discountCodeError ? "red.500" : undefined}
                      />
                      <Button
                        size="sm"
                        onClick={() => validateDiscountCode(discountCode)}
                        disabled={!discountCode.trim()}
                      >
                        Apply
                      </Button>
                    </HStack>
                  </HStack>
                  {discountCodeError && (
                    <Text fontSize="sm" color="red.500">
                      {discountCodeError}
                    </Text>
                  )}
                  {appliedDiscountCode && (
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="green.500">
                        {appliedDiscountCode.code} applied
                      </Text>
                      <Text fontSize="sm" color="green.500">
                        -${discountAmount.toFixed(2)}
                      </Text>
                    </HStack>
                  )}
                </VStack>

                <HStack justify="space-between">
                  <Text>Tax Rate (%):</Text>
                  <Text fontSize="sm" color="gray.400">
                    {taxRatePercent.toFixed(2)}%
                  </Text>
                </HStack>

                <HStack justify="space-between">
                  <Text>Tax Amount:</Text>
                  <Text>${bookingData.tax_amount.toFixed(2)}</Text>
                </HStack>

                <VStack align="stretch" gap={2}>
                  <HStack justify="space-between">
                    <Text>Tip:</Text>
                    <NumberInput.Root
                      size="sm"
                      min={0}
                      value={tip.toString()}
                      onValueChange={(details) =>
                        setTip(Number.parseFloat(details.value) || 0)
                      }
                      w="120px"
                    >
                      <NumberInput.Input />
                    </NumberInput.Root>
                  </HStack>

                  {/* Suggested tip amounts */}
                  <HStack gap={2} justify="center">
                    <Text fontSize="sm" color="text.muted">Quick tip:</Text>
                    {[10, 15, 20, 25].map((percentage) => {
                      const currentSubtotal = bookingData.selectedItems.reduce((sum, item) => {
                        return sum + item.price_per_unit * item.quantity
                      }, 0)
                      const suggestedAmount = (currentSubtotal - discountAmount) * (percentage / 100)
                      return (
                        <Button
                          key={percentage}
                          size="xs"
                          variant="outline"
                          onClick={() => setTip(suggestedAmount)}
                        >
                          {percentage}%
                        </Button>
                      )
                    })}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setTip(0)}
                    >
                      No tip
                    </Button>
                  </HStack>
                </VStack>

                <Separator />

                <HStack justify="space-between">
                  <Text fontWeight="bold" fontSize="lg">
                    Total:
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    ${bookingData.total.toFixed(2)}
                  </Text>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        </VStack>
      </HStack>

      {/* Navigation */}
      <HStack justify="space-between" pt={4}>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          colorPalette="blue"
          onClick={onNext}
          disabled={!canProceed || jurisdictionMissing}
        >
          Continue to Information
        </Button>
      </HStack>
    </VStack>
  )
}

export default Step2ItemSelection
