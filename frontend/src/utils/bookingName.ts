/** Matches backend `_validate_name_part` in app/models/booking.py */
export const BOOKING_NAME_PART_PATTERN = /^[\p{L}\p{N}\s\-'.]+$/u

export const BOOKING_NAME_PART_MESSAGE =
  "Name can only contain letters, numbers, spaces, periods, hyphens, and apostrophes"

export const BOOKING_NAME_MAX_LENGTH = 128
