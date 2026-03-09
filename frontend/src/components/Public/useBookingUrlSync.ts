import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react"

import type { BookingStepData } from "./bookingTypes"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface UseBookingUrlSyncArgs {
  bookingData: BookingStepData
  setBookingData: Dispatch<SetStateAction<BookingStepData>>
  setCurrentStep: Dispatch<SetStateAction<number>>
  initialDiscountCodeId?: string | null
  accessCodeDiscountCodeId?: string | null
  accessCode?: string | null
  didGoBackFromStep4Ref: MutableRefObject<boolean>
  hydratedForCodeRef: MutableRefObject<string | null>
}

/**
 * Encapsulates all URL <-> booking-data synchronisation logic:
 * reading initial params, writing back shareable state, and
 * handling discount / access-code propagation.
 */
export function useBookingUrlSync({
  bookingData,
  setBookingData,
  setCurrentStep,
  initialDiscountCodeId,
  accessCode,
  didGoBackFromStep4Ref,
  hydratedForCodeRef,
}: UseBookingUrlSyncArgs) {
  const search = useSearch({ from: "/book" })
  const navigate = useNavigate({ from: "/book" })
  const [hasInitializedSelectionFromUrl, setHasInitializedSelectionFromUrl] =
    useState(false)
  const lastSyncedDiscountRef = useRef<string | null>(null)

  // Apply discount code from URL
  useEffect(() => {
    if (search.discount) {
      setBookingData((prev) => ({
        ...prev,
        discount_code: search.discount,
      }))
    }
  }, [search.discount, setBookingData])

  // Apply launch/trip/boat from URL (only valid UUIDs)
  useEffect(() => {
    const launch =
      search.launch && UUID_RE.test(search.launch) ? search.launch : ""
    const trip = search.trip && UUID_RE.test(search.trip) ? search.trip : ""
    const boat = search.boat && UUID_RE.test(search.boat) ? search.boat : ""
    if (launch || trip || boat) {
      setBookingData((prev) => ({
        ...prev,
        ...(launch && { selectedLaunchId: launch }),
        ...(trip && { selectedTripId: trip }),
        ...(boat && { selectedBoatId: boat }),
      }))
    }
    setHasInitializedSelectionFromUrl(true)
  }, [search.launch, search.trip, search.boat, setBookingData])

  // Sync selected launch/trip/boat back to URL
  useEffect(() => {
    if (!hasInitializedSelectionFromUrl) return
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
      search: (prev: Record<string, string | undefined>) => ({
        ...prev,
        launch: dataLaunch || undefined,
        trip: dataTrip || undefined,
        boat: dataBoat || undefined,
      }),
    })
  }, [
    hasInitializedSelectionFromUrl,
    bookingData.selectedLaunchId,
    bookingData.selectedTripId,
    bookingData.selectedBoatId,
    search.launch,
    search.trip,
    search.boat,
    navigate,
  ])

  // Sync discount code to URL
  useEffect(() => {
    const dataDiscount = bookingData.discount_code ?? ""
    const urlDiscount = search.discount ?? ""
    const fromGate = !!(accessCode && initialDiscountCodeId)
    if (dataDiscount !== urlDiscount) {
      if (dataDiscount === "" && fromGate) return
      if (dataDiscount === "" && lastSyncedDiscountRef.current === "") return
      lastSyncedDiscountRef.current = dataDiscount
      navigate({
        search: (prev: Record<string, string | undefined>) => ({
          ...prev,
          discount: dataDiscount || undefined,
        }),
      })
    } else {
      lastSyncedDiscountRef.current = dataDiscount
    }
  }, [
    bookingData.discount_code,
    search.discount,
    navigate,
    accessCode,
    initialDiscountCodeId,
  ])

  // Apply discount code ID from AccessGate
  useEffect(() => {
    if (initialDiscountCodeId) {
      setBookingData((prev) => ({
        ...prev,
        discount_code_id: initialDiscountCodeId,
      }))
    }
  }, [initialDiscountCodeId, setBookingData])

  // When access=CODE is used and gate gave us the code ID, treat that code as the discount too
  useEffect(() => {
    if (accessCode && initialDiscountCodeId) {
      setBookingData((prev) =>
        prev.discount_code ? prev : { ...prev, discount_code: accessCode },
      )
    }
  }, [accessCode, initialDiscountCodeId, setBookingData])

  // When URL has a confirmation code, show step 4 (unless user went Back)
  useEffect(() => {
    if (search.code && !didGoBackFromStep4Ref.current) {
      setCurrentStep(4)
    }
    if (!search.code) {
      didGoBackFromStep4Ref.current = false
      hydratedForCodeRef.current = null
    }
  }, [search.code, setCurrentStep, didGoBackFromStep4Ref, hydratedForCodeRef])

  return { search }
}
