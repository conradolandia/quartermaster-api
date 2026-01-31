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

/** Format a Date as time without seconds (e.g. "2:30 PM") for display. */
export function formatTimeNoSeconds(date: Date): string {
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Format a Date as date + time without seconds for display. */
export function formatDateTimeNoSeconds(date: Date): string {
  if (Number.isNaN(date.getTime())) return ""
  return `${date.toLocaleDateString()} ${formatTimeNoSeconds(date)}`
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
 * Format a UTC date in a location's timezone for display, with timezone abbreviation (e.g. EST, PST).
 * Use when showing event times in the location's time (e.g. launch at Kennedy = America/New_York).
 */
export function formatInLocationTimezoneWithAbbr(
  utcDate: Date,
  timezone: string,
): { dateTime: string; timezoneAbbr: string } | null {
  if (Number.isNaN(utcDate.getTime()) || !timezone) return null
  const dateTime = formatInTimeZone(utcDate, timezone, "MMM d, yyyy h:mm a", {
    locale: enUS,
  })
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(utcDate)
  const timezoneAbbr = parts.find((p) => p.type === "timeZoneName")?.value ?? timezone
  return { dateTime, timezoneAbbr }
}

/**
 * Format an API datetime string in location timezone for display (date + time + abbr), or locale fallback.
 */
export function formatDateTimeInLocationTz(
  dateString: string | null | undefined,
  timezone?: string | null,
): string {
  if (!dateString) return ""
  const d = parseApiDate(dateString)
  const parts = timezone ? formatInLocationTimezoneWithAbbr(d, timezone) : null
  return parts ? `${parts.dateTime} ${parts.timezoneAbbr}` : formatDateTimeNoSeconds(d)
}

/**
 * Get timezone abbreviation (e.g. EST, PST) for an IANA timezone name.
 */
export function getTimezoneAbbr(ianaTimezone: string): string {
  if (!ianaTimezone) return ""
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTimezone,
      timeZoneName: "short",
    }).formatToParts(new Date())
    return parts.find((p) => p.type === "timeZoneName")?.value ?? ianaTimezone
  } catch {
    return ianaTimezone
  }
}

/**
 * Format location timezone for display: "America/New_York (EST)".
 */
export function formatLocationTimezoneDisplay(ianaTimezone: string): string {
  if (!ianaTimezone) return "UTC"
  const abbr = getTimezoneAbbr(ianaTimezone)
  return abbr === ianaTimezone ? ianaTimezone : `${ianaTimezone} (${abbr})`
}

/**
 * Common timezone abbreviations (US-centric) to IANA. Used when user enters e.g. "EST" in location form.
 * Backend stores IANA only.
 */
const ABBR_TO_IANA: Record<string, string> = {
  UTC: "UTC",
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
}

/**
 * Resolve user timezone input to IANA for API. Accepts IANA (e.g. America/New_York) or abbreviation (e.g. EST).
 */
export function resolveTimezoneInput(input: string | null | undefined): string | null {
  const trimmed = input?.trim()
  if (!trimmed) return null
  if (trimmed.includes("/")) return trimmed
  return ABBR_TO_IANA[trimmed.toUpperCase()] ?? null
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
