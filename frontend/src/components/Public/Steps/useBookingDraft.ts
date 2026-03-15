import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { type MutableRefObject, useEffect, useRef, useState } from "react"

import {
  type BookingCreate,
  BookingsService,
  PaymentsService,
} from "@/client"

import type { BookingResult, BookingStepData } from "../bookingTypes"
import { customerInfoSchema } from "./Step3CustomerInfo"

const CONFIRMED_STATUSES = ["confirmed", "checked_in", "completed"]

function generateConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

interface UseBookingDraftArgs {
  bookingData: BookingStepData
  bookingResult: BookingResult | null
  onBookingReady: (result: BookingResult) => void
  onResumeBookingLoaded?: (booking: BookingResult["booking"]) => void
  skipHydrateForm?: boolean
  urlCode?: string
  createBookingStartedRef: MutableRefObject<boolean>
  accessCodeDiscountCodeId?: string | null
  onCreateError?: () => void
}

export function useBookingDraft({
  bookingData,
  bookingResult,
  onBookingReady,
  onResumeBookingLoaded,
  skipHydrateForm,
  urlCode,
  createBookingStartedRef,
  accessCodeDiscountCodeId,
  onCreateError,
}: UseBookingDraftArgs) {
  const navigate = useNavigate()
  const search = useSearch({ from: "/book" })
  const queryClient = useQueryClient()
  const [isBookingSuccessful, setIsBookingSuccessful] = useState(false)
  const [customerInfoInvalid, setCustomerInfoInvalid] = useState(false)
  const createStartedRef = useRef(false)

  // --- Mutations ---

  const loadByCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const booking = await BookingsService.getBookingByConfirmationCode({
        confirmationCode: code,
      })
      return { booking }
    },
    onSuccess: async ({ booking }, code) => {
      const bookingStatus = (booking.booking_status ?? "") as string
      if (CONFIRMED_STATUSES.includes(bookingStatus)) {
        navigate({ to: "/bookings", search: { code } })
        return
      }
      if (bookingStatus === "cancelled") {
        navigate({
          to: "/book",
          search: { discount: search.discount, access: search.access },
          replace: true,
        })
        return
      }
      try {
        let bookingToUse = booking
        if (!skipHydrateForm) {
          onResumeBookingLoaded?.(booking)
        } else {
          const parsed = customerInfoSchema.safeParse(
            bookingData.customerInfo,
          )
          if (!parsed.success) {
            setCustomerInfoInvalid(true)
            return
          }
          setCustomerInfoInvalid(false)
          const updated =
            await BookingsService.bookingPublicUpdateDraftBooking({
              confirmationCode: code,
              requestBody: {
                first_name:
                  bookingData.customerInfo.first_name || undefined,
                last_name:
                  bookingData.customerInfo.last_name || undefined,
                user_email: bookingData.customerInfo.email || undefined,
                user_phone: bookingData.customerInfo.phone || undefined,
                billing_address:
                  bookingData.customerInfo.billing_address || undefined,
                special_requests:
                  bookingData.customerInfo.special_requests || undefined,
                launch_updates_pref:
                  bookingData.customerInfo.launch_updates_pref ?? undefined,
                tip_amount: bookingData.tip ?? undefined,
                subtotal: bookingData.subtotal,
                discount_amount: bookingData.discount_amount,
                tax_amount: bookingData.tax_amount,
                total_amount: bookingData.total,
              },
            })
          bookingToUse = updated
        }
        const totalCents = bookingToUse.total_amount ?? 0
        if (bookingStatus === "draft" && totalCents < 50) {
          await BookingsService.confirmFreeBooking({
            confirmationCode: code,
          })
          navigate({ to: "/bookings", search: { code } })
          return
        }
        const paymentData =
          bookingStatus === "draft"
            ? await BookingsService.initializePayment({
                confirmationCode: code,
              })
            : await BookingsService.resumePayment({
                confirmationCode: code,
              })
        onBookingReady({ booking: bookingToUse, paymentData })
      } catch {
        navigate({
          to: "/book",
          search: { discount: search.discount, access: search.access },
          replace: true,
        })
      }
    },
    onError: () => {
      navigate({
        to: "/book",
        search: { discount: search.discount, access: search.access },
        replace: true,
      })
    },
  })

  const createBookingMutation = useMutation({
    mutationFn: async (data: { bookingData: BookingStepData }) => {
      const { bookingData } = data

      const bookingCreate: BookingCreate = {
        first_name: bookingData.customerInfo.first_name,
        last_name: bookingData.customerInfo.last_name,
        user_email: bookingData.customerInfo.email,
        user_phone: bookingData.customerInfo.phone,
        billing_address: bookingData.customerInfo.billing_address || "",
        confirmation_code: generateConfirmationCode(),
        items: bookingData.selectedItems.map((item) => ({
          trip_id: item.trip_id,
          boat_id: bookingData.selectedBoatId,
          item_type: item.item_type,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
          trip_merchandise_id: item.trip_merchandise_id,
          variant_option: item.variant_option,
        })),
        subtotal: bookingData.subtotal,
        discount_amount: bookingData.discount_amount,
        tax_amount: bookingData.tax_amount,
        tip_amount: bookingData.tip,
        total_amount: bookingData.total,
        special_requests: bookingData.customerInfo.special_requests || "",
        launch_updates_pref:
          bookingData.customerInfo.launch_updates_pref ?? false,
        discount_code_id:
          accessCodeDiscountCodeId ?? bookingData.discount_code_id,
      }

      const booking = await BookingsService.createBooking({
        requestBody: bookingCreate,
      })
      if (bookingData.total < 50) {
        await BookingsService.confirmFreeBooking({
          confirmationCode: booking.confirmation_code,
        })
        return { booking, free: true as const }
      }
      const paymentData = await BookingsService.initializePayment({
        confirmationCode: booking.confirmation_code,
      })
      return { booking, paymentData }
    },
    onSuccess: (data) => {
      if ("free" in data && data.free) {
        navigate({
          to: "/bookings",
          search: { code: data.booking.confirmation_code },
        })
        return
      }
      onBookingReady({
        booking: data.booking,
        paymentData: data.paymentData!,
      })
    },
    onError: () => {
      createStartedRef.current = false
      createBookingStartedRef.current = false
      onCreateError?.()
    },
  })

  const completeBookingMutation = useMutation({
    mutationFn: async ({
      paymentIntentId,
      confirmationCode,
    }: {
      paymentIntentId: string
      confirmationCode: string
    }) => {
      await PaymentsService.verifyPayment({ paymentIntentId })
      return { paymentIntentId, confirmationCode }
    },
    onSuccess: (data) => {
      setIsBookingSuccessful(true)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setTimeout(() => {
        navigate({
          to: "/bookings",
          search: { code: data.confirmationCode },
        })
      }, 3000)
    },
  })

  // --- Effects ---

  // Re-fetch on bfcache restore (mobile)
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || !urlCode) return
      loadByCodeMutation.mutate(urlCode)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [urlCode])

  // Add confirmation code to URL after create success
  useEffect(() => {
    const code = bookingResult?.booking?.confirmation_code
    if (code && search.code !== code) {
      navigate({
        to: "/book",
        search: {
          discount: search.discount,
          access: search.access,
          code,
          trip: search.trip,
          launch: search.launch,
          boat: search.boat,
        },
        replace: true,
      })
    }
  }, [
    bookingResult?.booking?.confirmation_code,
    search.code,
    search.discount,
    search.access,
    search.trip,
    search.launch,
    search.boat,
    navigate,
  ])

  // Main flow: load by code or create new booking
  useEffect(() => {
    if (bookingResult) return
    if (urlCode) {
      createStartedRef.current = false
      createBookingStartedRef.current = false
      if (!loadByCodeMutation.isPending) {
        loadByCodeMutation.mutate(urlCode)
      }
      return
    }
    if (
      createStartedRef.current ||
      createBookingStartedRef.current ||
      createBookingMutation.isPending ||
      createBookingMutation.isError
    )
      return
    const parsed = customerInfoSchema.safeParse(bookingData.customerInfo)
    if (!parsed.success) {
      setCustomerInfoInvalid(true)
      return
    }
    setCustomerInfoInvalid(false)
    createStartedRef.current = true
    createBookingStartedRef.current = true
    createBookingMutation.mutate({ bookingData })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, bookingResult, bookingData.customerInfo])

  // --- Handlers ---

  const handlePaymentSuccess = (paymentIntentId: string) => {
    const confirmationCode = bookingResult?.booking?.confirmation_code
    if (!confirmationCode) return
    completeBookingMutation.mutate({ paymentIntentId, confirmationCode })
  }

  const handlePaymentError = (error: Error) => {
    console.error("Payment failed:", error.message)
  }

  const handleRetryVerification = () => {
    if (
      !bookingResult?.booking?.confirmation_code ||
      !bookingResult?.paymentData?.payment_intent_id
    )
      return
    completeBookingMutation.mutate({
      paymentIntentId: bookingResult.paymentData.payment_intent_id,
      confirmationCode: bookingResult.booking.confirmation_code,
    })
  }

  return {
    isBookingSuccessful,
    customerInfoInvalid,
    isPending:
      createBookingMutation.isPending || loadByCodeMutation.isPending,
    isCreateError: createBookingMutation.isError,
    isCompleteError: completeBookingMutation.isError,
    createError: createBookingMutation.error,
    isCompletePending: completeBookingMutation.isPending,
    canRetryVerification:
      completeBookingMutation.isError &&
      !!bookingResult?.booking?.confirmation_code &&
      !!bookingResult?.paymentData?.payment_intent_id,
    handlePaymentSuccess,
    handlePaymentError,
    handleRetryVerification,
  }
}
