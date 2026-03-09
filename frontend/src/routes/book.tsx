import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"

import {
  Button,
  Card,
  Container,
  Heading,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react"
import { type ApiError, BookingsService } from "@/client"
import AccessGate from "@/components/Public/AccessGate"
import BookingPageLayout from "@/components/Public/BookingPageLayout"
import PublicBookingForm from "@/components/Public/PublicBookingForm"

const bookSearchSchema = z.object({
  discount: z.string().optional(),
  access: z.string().optional(),
  code: z.string().optional(),
  launch: z.string().optional(),
  trip: z.string().optional(),
  boat: z.string().optional(),
})

/** Coerce all values to strings (TanStack Router may parse numeric params as numbers). */
function coerceToStrings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] =
      value !== undefined && value !== null && typeof value !== "string"
        ? String(value)
        : value
  }
  return result
}

/**
 * Normalize malformed URLs where ? was used instead of & for additional params.
 * e.g. ?trip=uuid?access=CODE parses as trip="uuid?access=CODE" and access is lost.
 * We detect trip value containing ?access= or ?discount= and extract the real trip ID and param.
 */
function normalizeBookSearch(
  raw: Record<string, unknown>,
): Record<string, string | undefined> {
  const coerced = coerceToStrings(raw)
  const trip = typeof coerced.trip === "string" ? coerced.trip : undefined
  if (!trip) return bookSearchSchema.parse(coerced) as Record<string, string | undefined>

  const accessMatch = trip.match(/\?access=([^&]*)/) ?? trip.match(/&access=([^&]*)/)
  const discountMatch =
    trip.match(/\?discount=([^&]*)/) ?? trip.match(/&discount=([^&]*)/)
  const match = accessMatch ?? discountMatch
  if (!match) return bookSearchSchema.parse(coerced) as Record<string, string | undefined>

  const paramValue = decodeURIComponent(match[1].replace(/\+/g, " "))
  const cleanTrip = trip.slice(0, match.index).replace(/[?&]$/, "")
  const normalized = {
    ...coerced,
    trip: cleanTrip || undefined,
    ...(accessMatch ? { access: paramValue } : { discount: paramValue }),
  }
  return bookSearchSchema.parse(normalized) as Record<string, string | undefined>
}

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
  validateSearch: (search) => normalizeBookSearch(search as Record<string, unknown>),
})

/** Fallback: read trip param from URL when router search may not have it yet (e.g. initial load). */
function getTripIdFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined
  const m = /[?&]trip=([^&]*)/.exec(window.location.search)
  return m ? decodeURIComponent(m[1]).split("?")[0] : undefined
}

const CONFIRMED_STATUSES = ["confirmed", "checked_in", "completed"]

function PublicBookingPage() {
  const search = useSearch({ from: "/book" })
  const navigate = useNavigate({ from: "/book" })
  const urlTripId = search.trip ?? getTripIdFromUrl()
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null)
  // Freeze the code used for the gate on first load so that later URL updates (e.g. applying
  // a discount on Step 2) do not retrigger the gate and remount the form at step 1.
  const initialAccessCodeRef = useRef<string | null>(null)

  // When URL has booking confirmation code but no trip (e.g. resume/refresh after step 4),
  // fetch booking to get trip_id so AccessGate can grant access via directTripId.
  const {
    data: bookingByCode,
    isLoading: isLoadingBookingByCode,
    isError: isBookingByCodeError,
    error: bookingByCodeError,
  } = useQuery({
    queryKey: ["booking-by-code", search.code],
    queryFn: () =>
      BookingsService.getBookingByConfirmationCode({
        confirmationCode: search.code!,
      }),
    enabled: !!search.code && !urlTripId,
  })

  const tripIdFromBooking =
    bookingByCode?.items?.[0]?.trip_id ?? undefined
  const directTripId = urlTripId ?? tripIdFromBooking

  // Redirect to confirmation when resuming by code and booking is already confirmed
  useEffect(() => {
    if (!search.code || !bookingByCode) return
    const status = (bookingByCode.booking_status ?? "") as string
    if (CONFIRMED_STATUSES.includes(status)) {
      navigate({ to: "/bookings", search: { code: search.code }, replace: true })
    }
  }, [bookingByCode, search.code, navigate])

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

  const resumeByCode = !!search.code && !urlTripId
  if (resumeByCode && isLoadingBookingByCode) {
    return (
      <BookingPageLayout>
        <Container maxW="container.md" py={16}>
          <VStack gap={4}>
            <Spinner size="xl" color="white" />
            <Text color="white">Loading your booking...</Text>
          </VStack>
        </Container>
      </BookingPageLayout>
    )
  }
  if (resumeByCode && isBookingByCodeError) {
    const status = (bookingByCodeError as ApiError)?.status
    const isNotFound = status === 404
    return (
      <BookingPageLayout>
        <Container maxW="container.md" py={16}>
          <Card.Root>
            <Card.Body>
              <VStack gap={4} textAlign="center">
                <Heading size="lg">
                  {isNotFound ? "Booking Not Found" : "Unable to Load Booking"}
                </Heading>
                <Text>
                  {isNotFound
                    ? "No booking matches this link. It may be invalid or expired."
                    : "We could not load this booking. Please try again or start a new booking."}
                </Text>
                <Button asChild colorPalette="blue">
                  <Link to="/book" search={{}}>Start a new booking</Link>
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>
        </Container>
      </BookingPageLayout>
    )
  }

  return (
    <AccessGate
      accessCode={initialAccessCode}
      directTripId={directTripId}
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
