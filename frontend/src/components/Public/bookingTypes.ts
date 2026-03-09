import type { BookingPublic } from "@/client"

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

export type BookingResult = { booking: any; paymentData: any }

export const INITIAL_BOOKING_DATA: BookingStepData = {
  selectedLaunchId: "",
  selectedTripId: "",
  selectedBoatId: "",
  boatRemainingCapacity: null,
  selectedItems: [],
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
  subtotal: 0,
  discount_amount: 0,
  tax_rate: 0,
  tax_amount: 0,
  tip: 0,
  total: 0,
  discount_code_id: null,
}

export const STEPS = [
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

/** Map API booking (e.g. from getBookingByConfirmationCode) to form step data for pre-fill when resuming. */
export function bookingPublicToStepData(
  booking: BookingPublic,
): BookingStepData {
  const first_name = booking.first_name ?? ""
  const last_name = booking.last_name ?? ""
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
