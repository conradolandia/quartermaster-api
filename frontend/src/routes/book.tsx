import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import AccessGate from "@/components/Public/AccessGate"
import PublicBookingForm from "@/components/Public/PublicBookingForm"

const bookSearchSchema = z.object({
  discount: z.string().optional(),
  access: z.string().optional(),
})

export const Route = createFileRoute("/book")({
  component: PublicBookingPage,
  validateSearch: (search) => bookSearchSchema.parse(search),
})

function PublicBookingPage() {
  const search = useSearch({ from: "/book" })
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null)

  // Use access code from URL if provided, otherwise check for discount code
  const initialAccessCode = search.access || search.discount

  const handleAccessGranted = (_accessCodeValue: string | null, codeId: string | null) => {
    if (codeId) {
      setDiscountCodeId(codeId)
    }
  }

  return (
    <AccessGate
      accessCode={initialAccessCode}
      onAccessGranted={handleAccessGranted}
    >
      {(accessCodeValue) => (
        <PublicBookingForm
          initialDiscountCodeId={discountCodeId}
          accessCode={accessCodeValue}
        />
      )}
    </AccessGate>
  )
}

export default PublicBookingPage
