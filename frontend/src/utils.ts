import { formatInTimeZone } from "date-fns-tz/formatInTimeZone"
import { toDate } from "date-fns-tz/toDate"
import { enUS } from "date-fns/locale/en-US"

import type { ApiError } from "./client"
import useCustomToast from "./hooks/useCustomToast"

/** localStorage key for date format preference (international vs locale). */
export const DATE_FORMAT_INTERNATIONAL_KEY = "date_format_international"

export function getUseInternationalDateFormat(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(DATE_FORMAT_INTERNATIONAL_KEY) === "true"
}

export function setUseInternationalDateFormat(value: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DATE_FORMAT_INTERNATIONAL_KEY, String(value))
}

/** Format a Date as YYYY-MM-DD HH:mm:ss (24-hour) in the given timezone or local. */
export function formatDateTimeInternational(
  date: Date,
  timezone?: string | null,
): string {
  if (Number.isNaN(date.getTime())) return ""
  const pattern = "yyyy-MM-dd HH:mm:ss"
  if (timezone) {
    return formatInTimeZone(date, timezone, pattern, { locale: enUS })
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/**
 * Parse a datetime string from the API as UTC for correct local display.
 * The API returns UTC; when the backend omits the "Z" suffix (naive datetimes
 * from the DB), JS parses as local time and shows wrong times. Treat strings
 * without timezone as UTC so format() displays in the user's locale.
 */
export function parseApiDate(isoString: string | null | undefined): Date {
  if (isoString == null || isoString === "") return new Date(Number.NaN)
  const hasTimezone =
    isoString.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(isoString)
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
  if (getUseInternationalDateFormat()) {
    return formatDateTimeInternational(date, null)
  }
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
  if (getUseInternationalDateFormat()) {
    return `${formatDateTimeInternational(utcDate, timezone)} ${timezone}`
  }
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
  if (getUseInternationalDateFormat()) {
    return {
      dateTime: formatDateTimeInternational(utcDate, timezone),
      timezone,
    }
  }
  const dateTime = formatInTimeZone(utcDate, timezone, "MMM d, yyyy h:mm a", {
    locale: enUS,
  })
  return { dateTime, timezone }
}

/**
 * Fallback abbreviations when Intl returns GMT+/- (e.g. America/Bogota -> COT).
 */
const TIMEZONE_ABBR_FALLBACK: Record<string, string> = {
  "America/Bogota": "COT",
  "America/New_York": "EST", // or EDT depending on date; Intl usually gives EST/EDT
  "America/Los_Angeles": "PST",
  "America/Chicago": "CST",
  "America/Denver": "MST",
  "America/Phoenix": "MST",
  "Europe/London": "GMT",
  "Europe/Paris": "CET",
  "UTC": "UTC",
}

function resolveTimezoneAbbr(ianaTimezone: string, fromIntl: string): string {
  if (!fromIntl || /^GMT[+-]\d+$/.test(fromIntl)) {
    return TIMEZONE_ABBR_FALLBACK[ianaTimezone] ?? fromIntl ?? ianaTimezone
  }
  return fromIntl
}

/**
 * Format a UTC date in a location's timezone for display, with timezone abbreviation (e.g. EST, COT).
 * Uses date-fns-tz "zzz" and a fallback map when Intl returns GMT+/- instead of an abbreviation.
 */
export function formatInLocationTimezoneWithAbbr(
  utcDate: Date,
  timezone: string,
): { dateTime: string; timezoneAbbr: string } | null {
  if (Number.isNaN(utcDate.getTime()) || !timezone) return null
  if (getUseInternationalDateFormat()) {
    const fromIntl = formatInTimeZone(utcDate, timezone, "zzz", {
      locale: enUS,
    }).trim()
    const timezoneAbbr = resolveTimezoneAbbr(timezone, fromIntl) || timezone
    return {
      dateTime: formatDateTimeInternational(utcDate, timezone),
      timezoneAbbr,
    }
  }
  const dateTime = formatInTimeZone(utcDate, timezone, "MMM d, yyyy h:mm a", {
    locale: enUS,
  })
  const fromIntl = formatInTimeZone(utcDate, timezone, "zzz", {
    locale: enUS,
  }).trim()
  const timezoneAbbr = resolveTimezoneAbbr(timezone, fromIntl) || timezone
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
  return parts
    ? `${parts.dateTime} ${parts.timezoneAbbr}`
    : formatDateTimeNoSeconds(d)
}

/**
 * Get timezone abbreviation (e.g. EST, COT) for an IANA timezone name.
 * Uses date-fns-tz "zzz" and a fallback map when Intl returns GMT+/-.
 */
export function getTimezoneAbbr(ianaTimezone: string): string {
  if (!ianaTimezone) return ""
  try {
    const fromIntl = formatInTimeZone(new Date(), ianaTimezone, "zzz", {
      locale: enUS,
    }).trim()
    return resolveTimezoneAbbr(ianaTimezone, fromIntl)
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
 * Valid American IANA timezones for location timezone select. Backend expects IANA names.
 */
export const US_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const

/**
 * Format a trip for display in dropdowns/lists: name and departure time in trip timezone.
 * Accepts trip-like objects with id, name, departure_time, timezone.
 */
export function formatTripLabel(trip: {
  id: string
  name?: string | null
  departure_time: string
  timezone?: string | null
}): string {
  const name = trip.name?.trim()
  const dep = trip.departure_time
  const tz = trip.timezone ?? "UTC"
  const dateStr = dep ? formatDateTimeInLocationTz(dep, tz) : ""
  if (name && dateStr) return `${name} – ${dateStr}`
  if (dateStr) return dateStr
  if (name) return name
  return trip.id
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
