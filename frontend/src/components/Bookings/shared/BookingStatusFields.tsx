import type { BookingUpdate } from "@/client"
import { Controller, type Control, type FieldErrors } from "react-hook-form"

import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"

export const BOOKING_STATUS_OPTIONS_EDIT = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked In" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const

export const PAYMENT_STATUS_OPTIONS_EDIT = [
  { value: "", label: "(none)" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "paid", label: "Paid" },
  { value: "free", label: "Free" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
] as const

interface BookingStatusFieldsCreateProps {
  mode: "create"
  bookingStatus: string
  paymentStatus: string
  onBookingStatusChange: (value: string) => void
  onPaymentStatusChange: (value: string) => void
}

interface BookingStatusFieldsEditProps {
  mode: "edit"
  control: Control<BookingUpdate>
  errors: FieldErrors<BookingUpdate>
}

export type BookingStatusFieldsProps =
  | BookingStatusFieldsCreateProps
  | BookingStatusFieldsEditProps

export function BookingStatusFields(props: BookingStatusFieldsProps) {
  if (props.mode === "create") {
    return (
      <>
        <Field label="Booking Status">
          <NativeSelect
            value={props.bookingStatus}
            onChange={(e) => props.onBookingStatusChange(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
          </NativeSelect>
        </Field>
        <Field label="Payment Status">
          <NativeSelect
            value={props.paymentStatus}
            onChange={(e) => props.onPaymentStatusChange(e.target.value)}
          >
            <option value="pending_payment">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </NativeSelect>
        </Field>
      </>
    )
  }

  return (
    <>
      <Field
        invalid={!!props.errors.booking_status}
        errorText={props.errors.booking_status?.message}
        label="Booking Status"
      >
        <Controller
          name="booking_status"
          control={props.control}
          render={({ field }) => (
            <NativeSelect {...field} value={field.value || ""}>
              {BOOKING_STATUS_OPTIONS_EDIT.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        />
      </Field>
      <Field
        invalid={!!props.errors.payment_status}
        errorText={props.errors.payment_status?.message}
        label="Payment Status"
      >
        <Controller
          name="payment_status"
          control={props.control}
          render={({ field }) => (
            <NativeSelect {...field} value={field.value ?? ""}>
              {PAYMENT_STATUS_OPTIONS_EDIT.map((option) => (
                <option key={option.value || "none"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        />
      </Field>
    </>
  )
}
