import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  DiscountCodesService,
  type EffectivePricingItem,
  JurisdictionsService,
  LaunchesService,
  MissionsService,
  TripBoatsService,
  type TripMerchandisePublic,
  TripMerchandiseService,
  TripsService,
} from "@/client"

import type { BookingStepData } from "../bookingTypes"

interface UseStep2LogicArgs {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  accessCode?: string | null
}

function discountFromCode(
  codeData: {
    discount_type: string
    discount_value: number
    max_discount_amount?: number | null
  },
  subtotal: number,
): number {
  if (subtotal <= 0) return 0
  let calculated = 0
  if (codeData.discount_type === "percentage") {
    const rate =
      codeData.discount_value > 1
        ? codeData.discount_value / 100
        : codeData.discount_value
    calculated = Math.round(subtotal * rate)
  } else {
    calculated = Math.round(codeData.discount_value)
  }
  if (codeData.max_discount_amount != null) {
    calculated = Math.min(calculated, codeData.max_discount_amount)
  }
  return Math.min(calculated, subtotal)
}

export function useStep2Logic({
  bookingData,
  updateBookingData,
  accessCode,
}: UseStep2LogicArgs) {
  const [discountAmount, setDiscountAmount] = useState(0)
  const [tip, setTip] = useState(0)
  const [discountCode, setDiscountCode] = useState(
    bookingData.discount_code || "",
  )
  const [discountCodeError, setDiscountCodeError] = useState("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null)
  const [merchandiseVariantByKey, setMerchandiseVariantByKey] = useState<
    Record<string, string>
  >({})

  // --- Queries ---

  const { data: tripData } = useQuery({
    queryKey: ["public-trip-details", bookingData.selectedTripId, accessCode],
    queryFn: () =>
      TripsService.readPublicTrip({
        tripId: bookingData.selectedTripId,
        accessCode: accessCode || undefined,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  const { data: missionData } = useQuery({
    queryKey: ["public-mission-details", tripData?.mission_id],
    queryFn: () => MissionsService.readPublicMissions({ limit: 100 }),
    enabled: !!tripData?.mission_id,
    select: (data) => data.data.find((m) => m.id === tripData?.mission_id),
  })

  const { data: launchData } = useQuery({
    queryKey: ["public-launch-details", missionData?.launch_id],
    queryFn: () =>
      LaunchesService.readPublicLaunch({ launchId: missionData!.launch_id }),
    enabled: !!missionData?.launch_id,
  })

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

  const taxRatePercent = jurisdictionsData?.data?.[0]?.sales_tax_rate
    ? jurisdictionsData.data[0].sales_tax_rate * 100
    : 0

  const jurisdictionMissing =
    !!launchData?.location_id &&
    !isLoadingJurisdictions &&
    (!jurisdictionsData?.data || jurisdictionsData.data.length === 0)

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

  const { data: tripMerchandise } = useQuery({
    queryKey: ["public-trip-merchandise", bookingData.selectedTripId],
    queryFn: () =>
      TripMerchandiseService.listPublicTripMerchandise({
        tripId: bookingData.selectedTripId,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  // --- Effects ---

  // Auto-validate discount code from URL
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

  // Recalculate pricing whenever items/tax/tip/discount change
  useEffect(() => {
    const subtotal = bookingData.selectedItems.reduce(
      (sum, item) => sum + item.price_per_unit * item.quantity,
      0,
    )
    const effectiveDiscount = appliedDiscountCode
      ? discountFromCode(appliedDiscountCode, subtotal)
      : discountAmount
    const discountCapped = Math.min(effectiveDiscount, subtotal)
    const afterDiscount = Math.max(0, subtotal - discountCapped)
    const taxAmount = Math.round(afterDiscount * (taxRatePercent / 100))
    const total = afterDiscount + taxAmount + Math.max(0, tip)

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

  // --- Discount ---

  const validateDiscountCode = async (code: string) => {
    if (!code.trim()) {
      setDiscountCodeError("")
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
      updateBookingData({ discount_code: "" })
      return
    }
    try {
      const subtotal = bookingData.selectedItems.reduce(
        (sum, item) => sum + item.quantity * item.price_per_unit,
        0,
      )
      const discountCodeData =
        await DiscountCodesService.validateDiscountCode({
          code: code.trim(),
          subtotalCents: subtotal,
          tripId: bookingData.selectedTripId ?? undefined,
        })
      setAppliedDiscountCode(discountCodeData)
      setDiscountCodeError("")
      updateBookingData({ discount_code: code.trim() })
      setDiscountAmount(discountFromCode(discountCodeData, subtotal))
    } catch (error: any) {
      setDiscountCodeError(
        error.response?.data?.detail || "Invalid discount code",
      )
      setAppliedDiscountCode(null)
      setDiscountAmount(0)
    }
  }

  // --- Capacity helpers ---

  const boatRemainingCapacity = bookingData.boatRemainingCapacity ?? 0

  const totalTicketsSelected = bookingData.selectedItems
    .filter((item) => !item.trip_merchandise_id)
    .reduce((sum, item) => sum + item.quantity, 0)

  const boatCapacityReached = totalTicketsSelected >= boatRemainingCapacity

  const currentQtyForTicketType = (type: string) =>
    bookingData.selectedItems
      .filter((item) => !item.trip_merchandise_id && item.item_type === type)
      .reduce((sum, item) => sum + item.quantity, 0)

  const remainingForType = (type: string) =>
    tripPricing?.find((p: EffectivePricingItem) => p.ticket_type === type)
      ?.remaining ?? 0

  const ticketCapacityReachedForType = (type: string) =>
    currentQtyForTicketType(type) >= remainingForType(type)

  const canAddTicketType = (type: string) =>
    !ticketCapacityReachedForType(type) && !boatCapacityReached

  // --- Item handlers ---

  const addTicket = (ticketType: string, price: number) => {
    if (!canAddTicketType(ticketType)) return
    const existingItem = bookingData.selectedItems.find(
      (item) => item.item_type === ticketType && !item.trip_merchandise_id,
    )
    const remaining = remainingForType(ticketType)
    if (remaining <= 0) return

    if (existingItem) {
      const newQty = currentQtyForTicketType(ticketType) + 1
      if (newQty > remaining) return
      if (totalTicketsSelected + 1 > boatRemainingCapacity) return
      const updatedItems = bookingData.selectedItems.map((item) =>
        item === existingItem ? { ...item, quantity: item.quantity + 1 } : item,
      )
      updateBookingData({ selectedItems: updatedItems })
    } else {
      if (totalTicketsSelected + 1 > boatRemainingCapacity) return
      updateBookingData({
        selectedItems: [
          ...bookingData.selectedItems,
          {
            trip_id: bookingData.selectedTripId,
            item_type: ticketType,
            quantity: 1,
            price_per_unit: price,
          },
        ],
      })
    }
  }

  const variantOptionsList = (opts: string | null | undefined): string[] =>
    opts
      ? opts
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
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
      updateBookingData({
        selectedItems: [
          ...bookingData.selectedItems,
          {
            trip_id: bookingData.selectedTripId,
            item_type: merchandise.name,
            quantity: 1,
            price_per_unit: merchandise.price,
            trip_merchandise_id: merchandise.id,
            variant_option: variantOption ?? undefined,
          },
        ],
      })
    }
  }

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      updateBookingData({
        selectedItems: bookingData.selectedItems.filter((_, i) => i !== index),
      })
      return
    }
    const item = bookingData.selectedItems[index]
    let cappedQuantity = newQuantity
    if (item && !item.trip_merchandise_id) {
      const pricing = tripPricing?.find(
        (p: EffectivePricingItem) => p.ticket_type === item.item_type,
      )
      if (pricing) {
        const otherSameType = bookingData.selectedItems
          .filter(
            (x, i) =>
              i !== index &&
              !x.trip_merchandise_id &&
              x.item_type === item.item_type,
          )
          .reduce((sum, x) => sum + x.quantity, 0)
        cappedQuantity = Math.min(
          newQuantity,
          Math.max(0, pricing.remaining - otherSameType),
        )
      }
      const otherTickets = bookingData.selectedItems
        .filter((x, i) => i !== index && !x.trip_merchandise_id)
        .reduce((sum, x) => sum + x.quantity, 0)
      cappedQuantity = Math.min(
        cappedQuantity,
        Math.max(0, boatRemainingCapacity - otherTickets),
      )
    }
    updateBookingData({
      selectedItems: bookingData.selectedItems.map((item, i) =>
        i === index ? { ...item, quantity: cappedQuantity } : item,
      ),
    })
  }

  const removeItem = (index: number) => {
    updateBookingData({
      selectedItems: bookingData.selectedItems.filter((_, i) => i !== index),
    })
  }

  return {
    // Data
    tripPricing,
    tripMerchandise,
    taxRatePercent,
    jurisdictionMissing,
    // Discount
    discountCode,
    setDiscountCode,
    discountCodeError,
    appliedDiscountCode,
    discountAmount,
    validateDiscountCode,
    // Tip
    tip,
    setTip,
    // Capacity
    boatRemainingCapacity,
    totalTicketsSelected,
    canAddTicketType,
    // Merch variants
    merchandiseVariantByKey,
    setMerchandiseVariantByKey,
    variantOptionsList,
    // Handlers
    addTicket,
    addMerchandise,
    updateItemQuantity,
    removeItem,
  }
}
