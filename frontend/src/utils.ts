import { enUS } from "date-fns/locale/en-US"
import { formatInTimeZone } from "date-fns-tz/formatInTimeZone"
import { toDate } from "date-fns-tz/toDate"

import type { ApiError } from "./client"
import useCustomToast from "./hooks/useCustomToast"

/**
 * Parse a datetime string from the API as UTC for correct local display.
 * The API returns UTC; when the backend omits the "Z" suffix (naive datetimes
 * from the DB), JS parses as local time and shows wrong times. Treat strings
 * without timezone as UTC so format() displays in the user's locale.
 */
export function parseApiDate(isoString: string | null | undefined): Date {
  if (isoString == null || isoString === "") return new Date(NaN)
  const hasTimezone = isoString.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(isoString)
  return new Date(hasTimezone ? isoString : `${isoString}Z`)
}

/**
 * Format a Date for an HTML datetime-local input (YYYY-MM-DDTHH:mm).
 * Uses the browser's local timezone so the input shows the same time as
 * toLocaleString() / list display.
 */
export function toDateTimeLocalString(date: Date): string {
  if (Number.isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * Format a UTC date in a location's timezone for datetime-local (YYYY-MM-DDTHH:mm).
 * Use when the event time is in the location's timezone (e.g. launch at Kennedy = America/New_York).
 */
export function formatInLocationTimezone(
  utcDate: Date,
  timezone: string,
): string {
  if (Number.isNaN(utcDate.getTime()) || !timezone) return ""
  return formatInTimeZone(utcDate, timezone, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Parse a datetime-local value (YYYY-MM-DDTHH:mm) as being in the location's timezone;
 * return UTC ISO string for the API.
 */
export function parseLocationTimeToUtc(
  localString: string | null | undefined,
  timezone: string,
): string {
  if (!localString?.trim() || !timezone) return ""
  const d = toDate(localString, { timeZone: timezone })
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

/**
 * Format a UTC date for display in a location's timezone, with IANA timezone name
 * (e.g. "Dec 31, 2027, 11:00 PM America/New_York"). Matches location.timezone format.
 */
export function formatInLocationTimezoneDisplay(
  utcDate: Date,
  timezone: string,
): string {
  if (Number.isNaN(utcDate.getTime()) || !timezone) return ""
  const formatted = formatInTimeZone(utcDate, timezone, "MMM d, yyyy h:mm a", {
    locale: enUS,
  })
  return `${formatted} ${timezone}`
}

/**
 * Same as formatInLocationTimezoneDisplay but returns date/time and timezone separately
 * so the timezone can be styled (e.g. smaller, muted).
 */
export function formatInLocationTimezoneDisplayParts(
  utcDate: Date,
  timezone: string,
): { dateTime: string; timezone: string } | null {
  if (Number.isNaN(utcDate.getTime()) || !timezone) return null
  const dateTime = formatInTimeZone(utcDate, timezone, "MMM d, yyyy h:mm a", {
    locale: enUS,
  })
  return { dateTime, timezone }
}

/**
 * Format an amount in cents as dollars with two decimal places (e.g. 1234 -> "12.34").
 * API amounts and prices are in integer cents.
 */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "0.00"
  return (cents / 100).toFixed(2)
}

export const emailPattern = {
  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  message: "Invalid email address",
}

export const namePattern = {
  value: /^[A-Za-z\s\u00C0-\u017F]{1,30}$/,
  message: "Invalid name",
}

export const passwordRules = (isRequired = true) => {
  const rules: any = {
    minLength: {
      value: 8,
      message: "Password must be at least 8 characters",
    },
  }

  if (isRequired) {
    rules.required = "Password is required"
  }

  return rules
}

export const confirmPasswordRules = (
  getValues: () => any,
  isRequired = true,
) => {
  const rules: any = {
    validate: (value: string) => {
      const password = getValues().password || getValues().new_password
      return value === password ? true : "The passwords do not match"
    },
  }

  if (isRequired) {
    rules.required = "Password confirmation is required"
  }

  return rules
}

export const handleError = (err: ApiError) => {
  const { showErrorToast } = useCustomToast()
  const errDetail = (err.body as any)?.detail
  let errorMessage = errDetail || "Something went wrong."
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    errorMessage = errDetail[0].msg
  }
  showErrorToast(errorMessage)
}
