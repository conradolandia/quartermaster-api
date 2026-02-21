import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"

import AccessGate from "@/components/Public/AccessGate"
import PublicBookingForm from "@/components/Public/PublicBookingForm"

const bookSearchSchema = z.object({
  discount: z.string().optional(),
  access: z.string().optional(),
  code: z.string().optional(),
  launch: z.string().optional(),
  trip: z.string().optional(),
  boat: z.string().optional(),
})

/**
 * Normalize malformed URLs where ? was used instead of & for additional params.
 * e.g. ?trip=uuid?access=CODE parses as trip="uuid?access=CODE" and access is lost.
 * We detect trip value containing ?access= or ?discount= and extract the real trip ID and param.
 */
function normalizeBookSearch(
  raw: Record<string, unknown>,
): Record<string, string | undefined> {
  const trip = typeof raw.trip === "string" ? raw.trip : undefined
  if (!trip) return bookSearchSchema.parse(raw) as Record<string, string | undefined>

  const accessMatch = trip.match(/\?access=([^&]*)/) ?? trip.match(/&access=([^&]*)/)
  const discountMatch =
    trip.match(/\?discount=([^&]*)/) ?? trip.match(/&discount=([^&]*)/)
  const match = accessMatch ?? discountMatch
  if (!match) return bookSearchSchema.parse(raw) as Record<string, string | undefined>

  const paramValue = decodeURIComponent(match[1].replace(/\+/g, " "))
  const cleanTrip = trip.slice(0, match.index).replace(/[?&]$/, "")
  const normalized = {
    ...raw,
    trip: cleanTrip || undefined,
    ...(accessMatch ? { access: paramValue } : { discount: paramValue }),
  }
  return bookSearchSchema.parse(normalized) as Record<string, string | undefined>
}

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
  validateSearch: (search) => normalizeBookSearch(search as Record<string, unknown>),
})

function PublicBookingPage() {
  const search = useSearch({ from: "/book" })
  const navigate = useNavigate({ from: "/book" })
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null)
  // Freeze the code used for the gate on first load so that later URL updates (e.g. applying
  // a discount on Step 2) do not retrigger the gate and remount the form at step 1.
  const initialAccessCodeRef = useRef<string | null>(null)

  // Replace malformed URL in bar (e.g. ?trip=uuid?access=CODE) with correct format
  const hasRedirectedRef = useRef(false)
  useEffect(() => {
    if (hasRedirectedRef.current) return
    const raw = window.location.search
    if (!raw) return
    const tripParam = /[?&]trip=([^&]*)/.exec(raw)?.[1]
    if (!tripParam) return
    const decoded = decodeURIComponent(tripParam)
    if (decoded.includes("?access=") || decoded.includes("?discount=")) {
      hasRedirectedRef.current = true
      navigate({
        to: "/book",
        search: {
          trip: search.trip,
          access: search.access,
          discount: search.discount,
          launch: search.launch,
          boat: search.boat,
          code: search.code,
        },
        replace: true,
      })
    }
  }, [search, navigate])

  useEffect(() => {
    if (initialAccessCodeRef.current === null) {
      initialAccessCodeRef.current =
        search.access || search.discount || ""
    }
  }, [search.access, search.discount])
  const initialAccessCode =
    initialAccessCodeRef.current === null
      ? (search.access || search.discount)
      : (initialAccessCodeRef.current || undefined)

  const handleAccessGranted = (
    _accessCodeValue: string | null,
    codeId: string | null,
  ) => {
    if (codeId) {
      setDiscountCodeId(codeId)
    }
  }

  return (
    <AccessGate
      accessCode={initialAccessCode}
      directTripId={search.trip}
      onAccessGranted={handleAccessGranted}
    >
      {(accessCodeValue, discountCodeIdFromGate) => (
        <PublicBookingForm
          initialDiscountCodeId={discountCodeIdFromGate ?? discountCodeId}
          accessCodeDiscountCodeId={discountCodeIdFromGate}
          accessCode={accessCodeValue}
        />
      )}
    </AccessGate>
  )
}

export default PublicBookingPage
