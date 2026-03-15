import { Input, Textarea } from "@chakra-ui/react"

import { Field } from "@/components/ui/field"

/** Minimal errors shape for customer fields; compatible with any form that has these keys. */
export interface BookingCustomerErrors {
  first_name?: { message?: string }
  last_name?: { message?: string }
  user_email?: { message?: string }
  user_phone?: { message?: string }
  billing_address?: { message?: string }
  admin_notes?: { message?: string }
}

export interface BookingCustomerFieldsProps {
  /** Register from useForm (AddBooking/EditBooking use different form types). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared between Add and Edit which use different form types
  register: any
  errors: BookingCustomerErrors
  required?: boolean
}

export function BookingCustomerFields({
  register,
  errors,
  required = false,
}: BookingCustomerFieldsProps) {
  return (
    <>
      <Field
        invalid={!!errors.first_name}
        errorText={errors.first_name?.message}
        label="First Name"
        required={required}
      >
        <Input
          id="first_name"
          {...register("first_name", {
            ...(required && { required: "First name is required" }),
            maxLength: {
              value: 128,
              message: "First name cannot exceed 128 characters",
            },
          })}
          placeholder={required ? "First Name" : "First name"}
          type="text"
        />
      </Field>
      <Field
        invalid={!!errors.last_name}
        errorText={errors.last_name?.message}
        label="Last Name"
        required={required}
      >
        <Input
          id="last_name"
          {...register("last_name", {
            ...(required && { required: "Last name is required" }),
            maxLength: {
              value: 128,
              message: "Last name cannot exceed 128 characters",
            },
          })}
          placeholder={required ? "Last Name" : "Last name"}
          type="text"
        />
      </Field>
      <Field
        invalid={!!errors.user_email}
        errorText={errors.user_email?.message}
        label="Customer Email"
        required={required}
      >
        <Input
          id="user_email"
          type="email"
          {...register("user_email", {
            ...(required && { required: "Customer email is required" }),
            ...(required && {
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            }),
            maxLength: {
              value: 255,
              message:
                (required ? "Customer email" : "Email") +
                " cannot exceed 255 characters",
            },
          })}
          placeholder="customer@example.com"
        />
      </Field>
      <Field
        invalid={!!errors.user_phone}
        errorText={errors.user_phone?.message}
        label="Customer Phone"
        required={required}
      >
        <Input
          id="user_phone"
          {...register("user_phone", {
            ...(required && { required: "Customer phone is required" }),
            maxLength: {
              value: 40,
              message:
                (required ? "Customer phone" : "Phone") +
                " cannot exceed 40 characters",
            },
          })}
          placeholder={required ? "Customer Phone" : "Phone number"}
          type="tel"
        />
      </Field>
      <Field
        invalid={!!errors.billing_address}
        errorText={errors.billing_address?.message}
        label="Billing Address"
        required={required}
      >
        <Textarea
          id="billing_address"
          {...register("billing_address", {
            ...(required && { required: "Billing address is required" }),
            maxLength: {
              value: 1000,
              message: "Billing address cannot exceed 1000 characters",
            },
          })}
          placeholder={required ? "Billing Address" : "Billing address"}
          rows={3}
        />
      </Field>
      <Field
        invalid={!!errors.admin_notes}
        errorText={errors.admin_notes?.message}
        label="Admin Notes"
        helperText="Admin only. Not visible to customers."
      >
        <Textarea
          id="admin_notes"
          {...register("admin_notes", {
            maxLength: {
              value: 2000,
              message: "Admin notes cannot exceed 2000 characters",
            },
          })}
          placeholder="Internal notes about this booking"
          rows={3}
        />
      </Field>
    </>
  )
}
