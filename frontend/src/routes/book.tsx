import { createFileRoute, useSearch } from "@tanstack/react-router"
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

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
  validateSearch: (search) => bookSearchSchema.parse(search),
})

function PublicBookingPage() {
  const search = useSearch({ from: "/book" })
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null)
  // Freeze the code used for the gate on first load so that later URL updates (e.g. applying
  // a discount on Step 2) do not retrigger the gate and remount the form at step 1.
  const initialAccessCodeRef = useRef<string | null>(null)
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
