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
  Select,
  Separator,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { FiAlertCircle, FiTrash2 } from "react-icons/fi"

import {
  DiscountCodesService,
  JurisdictionsService,
  LaunchesService,
  MissionsService,
  TripBoatsService,
  type TripMerchandisePublic,
  TripMerchandiseService,
  TripsService,
} from "@/client"
import type { EffectivePricingItem } from "@/client"
import { formatCents } from "@/utils"

import type { BookingStepData } from "../PublicBookingForm"

interface Step2ItemSelectionProps {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  onNext: () => void
  onBack: () => void
  accessCode?: string | null
}

const Step2ItemSelection = ({
  bookingData,
  updateBookingData,
  onNext,
  onBack,
  accessCode,
}: Step2ItemSelectionProps) => {
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [tip, setTip] = useState<number>(0)
  const [discountCode, setDiscountCode] = useState<string>(
    bookingData.discount_code || "",
  )
  const [discountCodeError, setDiscountCodeError] = useState<string>("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null)
  const [merchandiseVariantByKey, setMerchandiseVariantByKey] = useState<
    Record<string, string>
  >({})

  // Fetch trip details to get jurisdiction for tax rate (using public endpoint)
  const { data: tripData } = useQuery({
    queryKey: ["public-trip-details", bookingData.selectedTripId, accessCode],
    queryFn: () =>
      TripsService.readPublicTrip({
        tripId: bookingData.selectedTripId,
        accessCode: accessCode || undefined,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  // Fetch mission details (using public endpoint)
  const { data: missionData } = useQuery({
    queryKey: ["public-mission-details", tripData?.mission_id],
    queryFn: () => MissionsService.readPublicMissions({ limit: 100 }),
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

  // Fetch jurisdiction for tax rate (using public endpoint)
  const { data: jurisdictionsData, isPending: isLoadingJurisdictions } =
    useQuery({
      queryKey: ["public-jurisdictions-by-location", launchData?.location_id],
      queryFn: () =>
        JurisdictionsService.readPublicJurisdictions({
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
  // Only show error if query has completed (not loading) and no data found
  const jurisdictionMissing =
    !!launchData?.location_id &&
    !isLoadingJurisdictions &&
    (!jurisdictionsData?.data || jurisdictionsData.data.length === 0)

  // Auto-validate discount code when pre-filled from URL (or when code changes). Run when we have
  // a code that is not yet applied (e.g. Step2 just mounted with ?discount=LOL67).
  useEffect(() => {
    const codeFromUrl = bookingData.discount_code?.trim()
    if (!codeFromUrl) return
    if (discountCode !== codeFromUrl) {
      setDiscountCode(codeFromUrl)
    }
    if (appliedDiscountCode?.code !== codeFromUrl) {
      validateDiscountCode(codeFromUrl)
    }
  }, [bookingData.discount_code, appliedDiscountCode?.code])

  // Validate discount code
  const validateDiscountCode = async (code: string) => {
    if (!code.trim()) {
      setDiscountCodeError("")
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
      updateBookingData({ discount_code: "" })
      return
    }

    try {
      const subtotal = bookingData.selectedItems.reduce((sum, item) => {
        return sum + item.quantity * item.price_per_unit
      }, 0)

      const discountCodeData = await DiscountCodesService.validateDiscountCode({
        code: code.trim(),
        subtotalCents: subtotal,
      })

      setAppliedDiscountCode(discountCodeData)
      setDiscountCodeError("")
      updateBookingData({ discount_code: code.trim() })

      // API: percentage = 0-100 (e.g. 10 for 10%), fixed_amount = cents (e.g. 500 for $5)
      let calculatedDiscount = 0
      if (discountCodeData.discount_type === "percentage") {
        const rate =
          discountCodeData.discount_value > 1
            ? discountCodeData.discount_value / 100
            : discountCodeData.discount_value
        calculatedDiscount = Math.round(subtotal * rate)
        if (discountCodeData.max_discount_amount != null) {
          calculatedDiscount = Math.min(
            calculatedDiscount,
            discountCodeData.max_discount_amount,
          )
        }
        calculatedDiscount = Math.min(calculatedDiscount, subtotal)
      } else {
        calculatedDiscount = Math.round(discountCodeData.discount_value)
        if (discountCodeData.max_discount_amount != null) {
          calculatedDiscount = Math.min(
            calculatedDiscount,
            discountCodeData.max_discount_amount,
          )
        }
        calculatedDiscount = Math.min(calculatedDiscount, subtotal)
      }

      setDiscountAmount(calculatedDiscount)
    } catch (error: any) {
      setDiscountCodeError(
        error.response?.data?.detail || "Invalid discount code",
      )
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
    }
  }

  // Fetch effective pricing for selected trip + boat (public endpoint)
  const { data: tripPricing } = useQuery({
    queryKey: [
      "public-effective-pricing",
      bookingData.selectedTripId,
      bookingData.selectedBoatId,
    ],
    queryFn: () =>
      TripBoatsService.readPublicEffectivePricing({
        tripId: bookingData.selectedTripId,
        boatId: bookingData.selectedBoatId,
      }),
    enabled: !!bookingData.selectedTripId && !!bookingData.selectedBoatId,
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

  // Compute discount from applied code and current subtotal (so discount updates when items change)
  const discountFromCode = (
    codeData: {
      discount_type: string
      discount_value: number
      max_discount_amount?: number | null
    },
    subtotal: number,
  ): number => {
    if (subtotal <= 0) return 0
    let calculated = 0
    if (codeData.discount_type === "percentage") {
      const rate =
        codeData.discount_value > 1
          ? codeData.discount_value / 100
          : codeData.discount_value
      calculated = Math.round(subtotal * rate)
      if (codeData.max_discount_amount != null) {
        calculated = Math.min(calculated, codeData.max_discount_amount)
      }
      calculated = Math.min(calculated, subtotal)
    } else {
      calculated = Math.round(codeData.discount_value)
      if (codeData.max_discount_amount != null) {
        calculated = Math.min(calculated, codeData.max_discount_amount)
      }
      calculated = Math.min(calculated, subtotal)
    }
    return calculated
  }

  // Calculate pricing whenever items or tax rate change (all amounts in cents)
  // Re-run when jurisdictionsData loads so tax is applied once jurisdiction is available
  useEffect(() => {
    const subtotal = bookingData.selectedItems.reduce((sum, item) => {
      return sum + item.price_per_unit * item.quantity
    }, 0)
    const effectiveDiscount = appliedDiscountCode
      ? discountFromCode(appliedDiscountCode, subtotal)
      : discountAmount
    const discountCapped = Math.min(effectiveDiscount, subtotal)
    const afterDiscount = Math.max(0, subtotal - discountCapped)
    // taxRatePercent is 0-100 (e.g. 8.5 for 8.5%); sales_tax_rate from API is 0-1
    const taxAmount = Math.round(afterDiscount * (taxRatePercent / 100))
    const total = afterDiscount + taxAmount + Math.max(0, tip)

    // Keep discountAmount in sync when code is applied so suggested-tip and UI stay correct
    if (appliedDiscountCode && effectiveDiscount !== discountAmount) {
      setDiscountAmount(effectiveDiscount)
    }

    updateBookingData({
      subtotal,
      discount_amount: discountCapped,
      tax_rate: taxRatePercent,
      tax_amount: taxAmount,
      tip: Math.max(0, tip),
      total,
      discount_code_id: appliedDiscountCode?.id || null,
    })
  }, [
    bookingData.selectedItems,
    discountAmount,
    taxRatePercent,
    tip,
    appliedDiscountCode,
    jurisdictionsData,
  ])

  const currentQtyForTicketType = (type: string) =>
    bookingData.selectedItems
      .filter((item) => !item.trip_merchandise_id && item.item_type === type)
      .reduce((sum, item) => sum + item.quantity, 0)
  const remainingForType = (type: string) =>
    tripPricing?.find((p) => p.ticket_type === type)?.remaining ?? 0
  const ticketCapacityReachedForType = (type: string) =>
    currentQtyForTicketType(type) >= remainingForType(type)

  // Total tickets selected (excluding merchandise) for boat capacity check
  const totalTicketsSelected = bookingData.selectedItems
    .filter((item) => !item.trip_merchandise_id)
    .reduce((sum, item) => sum + item.quantity, 0)

  // Remaining boat capacity (total seats left on the boat)
  const boatRemainingCapacity = bookingData.boatRemainingCapacity ?? 0

  // Check if adding one more ticket would exceed boat capacity
  const boatCapacityReached = totalTicketsSelected >= boatRemainingCapacity

  // For a specific ticket type: check both per-type limit AND total boat capacity
  const canAddTicketType = (type: string) =>
    !ticketCapacityReachedForType(type) && !boatCapacityReached

  const addTicket = (ticketType: string, price: number) => {
    // Check both per-type capacity and total boat capacity
    if (!canAddTicketType(ticketType)) return
    const existingItem = bookingData.selectedItems.find(
      (item) => item.item_type === ticketType && !item.trip_merchandise_id,
    )
    const remaining = remainingForType(ticketType)
    if (remaining <= 0) return

    if (existingItem) {
      const newQty = currentQtyForTicketType(ticketType) + 1
      if (newQty > remaining) return
      // Also check total boat capacity
      if (totalTicketsSelected + 1 > boatRemainingCapacity) return
      const updatedItems = bookingData.selectedItems.map((item) =>
        item === existingItem ? { ...item, quantity: item.quantity + 1 } : item,
      )
      updateBookingData({ selectedItems: updatedItems })
    } else {
      // Check total boat capacity before adding new item
      if (totalTicketsSelected + 1 > boatRemainingCapacity) return
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

  const variantOptionsList = (opts: string | null | undefined): string[] =>
    opts
      ? opts.split(",").map((o) => o.trim()).filter(Boolean)
      : []

  const addMerchandise = (
    merchandise: TripMerchandisePublic,
    variantOption?: string,
  ) => {
    const options = variantOptionsList(merchandise.variant_options)
    const requiredVariant = options.length > 0
    if (requiredVariant && !variantOption) return
    if (requiredVariant && variantOption && !options.includes(variantOption))
      return

    const existingItem = bookingData.selectedItems.find(
      (item) =>
        item.trip_merchandise_id === merchandise.id &&
        (item.variant_option ?? undefined) === (variantOption ?? undefined),
    )

    if (existingItem) {
      if (existingItem.quantity < merchandise.quantity_available) {
        const updatedItems = bookingData.selectedItems.map((item) =>
          item === existingItem
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
        updateBookingData({ selectedItems: updatedItems })
      }
    } else {
      const newItem = {
        trip_id: bookingData.selectedTripId,
        item_type: merchandise.name,
        quantity: 1,
        price_per_unit: merchandise.price,
        trip_merchandise_id: merchandise.id,
        variant_option: variantOption ?? undefined,
      }
      updateBookingData({
        selectedItems: [...bookingData.selectedItems, newItem],
      })
    }
  }

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      const updatedItems = bookingData.selectedItems.filter(
        (_, i) => i !== index,
      )
      updateBookingData({ selectedItems: updatedItems })
      return
    }
    const item = bookingData.selectedItems[index]
    let cappedQuantity = newQuantity
    if (item && !item.trip_merchandise_id) {
      const pricing = tripPricing?.find((p) => p.ticket_type === item.item_type)
      if (pricing) {
        const otherSameType = bookingData.selectedItems
          .filter(
            (x, i) =>
              i !== index &&
              !x.trip_merchandise_id &&
              x.item_type === item.item_type,
          )
          .reduce((sum, x) => sum + x.quantity, 0)
        // Cap by per-type remaining capacity
        cappedQuantity = Math.min(
          newQuantity,
          Math.max(0, pricing.remaining - otherSameType),
        )
      }
      // Also cap by total boat remaining capacity
      const otherTickets = bookingData.selectedItems
        .filter((x, i) => i !== index && !x.trip_merchandise_id)
        .reduce((sum, x) => sum + x.quantity, 0)
      const maxByBoat = Math.max(0, boatRemainingCapacity - otherTickets)
      cappedQuantity = Math.min(cappedQuantity, maxByBoat)
    }
    const updatedItems = bookingData.selectedItems.map((item, i) =>
      i === index ? { ...item, quantity: cappedQuantity } : item,
    )
    updateBookingData({ selectedItems: updatedItems })
  }

  const removeItem = (index: number) => {
    const updatedItems = bookingData.selectedItems.filter((_, i) => i !== index)
    updateBookingData({ selectedItems: updatedItems })
  }

  const canProceed = bookingData.selectedItems.length > 0

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="5xl" mb={2} fontWeight="200">
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
                  No tax jurisdiction is configured for this location. Please
                  contact support to complete your booking.
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
                <Heading size="2xl" mb={4}>
                  Tickets
                </Heading>
                {/* Show total boat capacity info */}
                <Text fontSize="sm" color="text.muted" mb={3}>
                  {boatRemainingCapacity - totalTicketsSelected > 0
                    ? `${boatRemainingCapacity - totalTicketsSelected} seat(s) remaining on boat`
                    : "Boat is at full capacity"}
                </Text>
                <VStack gap={3} align="stretch">
                  {tripPricing.map((pricing: EffectivePricingItem) => (
                    <HStack key={pricing.ticket_type} justify="space-between">
                      <Box>
                        <Text fontWeight="medium" fontSize="lg">
                          {pricing.ticket_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                        <Text fontSize="sm" color="gray.400">
                          ${formatCents(pricing.price)} each
                        </Text>
                        {pricing.remaining >= 0 && (
                          <Text fontSize="xs" color="text.muted" mt={1}>
                            {pricing.remaining} left
                          </Text>
                        )}
                      </Box>
                      <Button
                        size="sm"
                        disabled={!canAddTicketType(pricing.ticket_type)}
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
                <Heading size="2xl" mb={4}>
                  Merchandise
                </Heading>
                <VStack gap={3} align="stretch">
                  {tripMerchandise.map((merchandise: TripMerchandisePublic) => {
                    const options = variantOptionsList(
                      merchandise.variant_options,
                    )
                    const hasVariants = options.length > 0
                    const selectedVariant =
                      merchandiseVariantByKey[merchandise.id] ?? options[0]
                    return (
                      <HStack
                        key={merchandise.id}
                        justify="space-between"
                        align="end"
                        gap={2}
                      >
                        <Box flex={1}>
                          <Text fontWeight="medium" fontSize="lg">
                            {merchandise.name}
                          </Text>
                          {merchandise.description && (
                            <Text
                              fontSize="sm"
                              color="gray.400"
                              lineClamp={2}
                            >
                              {merchandise.description}
                            </Text>
                          )}
                          <HStack gap={2} mt={1}>
                            <Text fontSize="sm" color="gray.400">
                              ${formatCents(merchandise.price)} each
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
                        <HStack gap={2} align="end">
                          {hasVariants && (
                            <Select.Root
                              size="sm"
                              width="min(120px, 25vw)"
                              value={[selectedVariant]}
                              onValueChange={(e) =>
                                setMerchandiseVariantByKey((prev) => ({
                                  ...prev,
                                  [merchandise.id]: e.value[0] ?? "",
                                }))
                              }
                              collection={createListCollection({
                                items: options.map((o) => ({
                                  label: o,
                                  value: o,
                                })),
                              })}
                            >
                              <Select.Control>
                                <Select.Trigger>
                                  <Select.ValueText placeholder="Variant" />
                                </Select.Trigger>
                              </Select.Control>
                              <Select.Positioner>
                                <Select.Content>
                                  {options.map((o) => (
                                    <Select.Item
                                      key={o}
                                      item={{ label: o, value: o }}
                                    >
                                      {o}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Positioner>
                            </Select.Root>
                          )}
                          <Button
                            size="sm"
                            colorPalette="blue"
                            disabled={
                              merchandise.quantity_available === 0 ||
                              (hasVariants && !selectedVariant)
                            }
                            onClick={() =>
                              addMerchandise(
                                merchandise,
                                hasVariants ? selectedVariant : undefined,
                              )
                            }
                          >
                            Add
                          </Button>
                        </HStack>
                      </HStack>
                    )
                  })}
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
              <Heading size="2xl" mb={4}>
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
                      ? item.variant_option
                        ? `${merchandise.name} – ${item.variant_option}`
                        : merchandise.name
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
                            ${formatCents(item.price_per_unit)} ×{" "}
                            {item.quantity}
                          </Text>
                        </Box>
                        <HStack gap={2}>
                          <NumberInput.Root
                            size="sm"
                            min={0}
                            max={
                              merchandise
                                ? merchandise.quantity_available
                                : (() => {
                                    if (!item.trip_merchandise_id && pricing) {
                                      const otherSameType =
                                        bookingData.selectedItems
                                          .filter(
                                            (x, i) =>
                                              i !== index &&
                                              !x.trip_merchandise_id &&
                                              x.item_type === item.item_type,
                                          )
                                          .reduce(
                                            (sum, x) => sum + x.quantity,
                                            0,
                                          )
                                      const maxByType = Math.max(
                                        0,
                                        pricing.remaining - otherSameType,
                                      )
                                      // Also cap by total boat capacity
                                      const otherTickets =
                                        bookingData.selectedItems
                                          .filter(
                                            (x, i) =>
                                              i !== index &&
                                              !x.trip_merchandise_id,
                                          )
                                          .reduce(
                                            (sum, x) => sum + x.quantity,
                                            0,
                                          )
                                      const maxByBoat = Math.max(
                                        0,
                                        boatRemainingCapacity - otherTickets,
                                      )
                                      return Math.min(maxByType, maxByBoat)
                                    }
                                    return 999
                                  })()
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
              <Heading size="2xl" mb={4}>
                Pricing Summary
              </Heading>
              <VStack gap={3} align="stretch">
                <HStack justify="space-between">
                  <Text fontWeight="medium" fontSize="lg">
                    Subtotal:
                  </Text>
                  <Text fontWeight="semibold" fontSize="lg">
                    ${formatCents(bookingData.subtotal)}
                  </Text>
                </HStack>
                <Separator />

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
                      <Text
                        fontSize="sm"
                        color="green.500"
                        fontWeight="semibold"
                      >
                        -${formatCents(bookingData.discount_amount)}
                      </Text>
                    </HStack>
                  )}
                </VStack>

                <Separator />

                <HStack justify="space-between">
                  <Text>Tax ({taxRatePercent.toFixed(2)}%):</Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    ${formatCents(bookingData.tax_amount)}
                  </Text>
                </HStack>

                <Separator />

                <VStack align="stretch" gap={2}>
                  <HStack justify="space-between">
                    {/* Suggested tip amounts */}
                    <HStack gap={2}>
                      <Text>Tip:</Text>
                      {[10, 15, 20, 25].map((percentage) => {
                        const currentSubtotal =
                          bookingData.selectedItems.reduce((sum, item) => {
                            return sum + item.price_per_unit * item.quantity
                          }, 0)
                        const effectiveDiscount = Math.min(
                          discountAmount,
                          currentSubtotal,
                        )
                        const suggestedAmount = Math.round(
                          Math.max(
                            0,
                            (currentSubtotal - effectiveDiscount) *
                              (percentage / 100),
                          ),
                        )
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
                    <NumberInput.Root
                      size="sm"
                      min={0}
                      value={(tip / 100).toFixed(2)}
                      onValueChange={(details) => {
                        const dollars =
                          Number.parseFloat(details.value || "0") || 0
                        setTip(Math.round(dollars * 100))
                      }}
                      w="120px"
                    >
                      <NumberInput.Input />
                    </NumberInput.Root>
                  </HStack>
                </VStack>

                <Separator />

                <HStack justify="space-between">
                  <Text fontWeight="bold" fontSize="xl">
                    Total:
                  </Text>
                  <Text fontWeight="bold" fontSize="xl">
                    ${formatCents(bookingData.total)}
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
