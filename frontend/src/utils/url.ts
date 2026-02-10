const ADMIN_PREFIX = "admin."

/**
 * Origin for public booking URLs. Strips the admin subdomain when present
 * so copied links point to the public site (e.g. book.star-fleet.tours, not admin.book.star-fleet.tours).
 */
export function getPublicOrigin(): string {
  try {
    const url = new URL(window.location.origin)
    if (url.hostname.startsWith(ADMIN_PREFIX)) {
      url.hostname = url.hostname.slice(ADMIN_PREFIX.length)
      return url.origin
    }
  } catch {
    // fallback if URL parsing fails
  }
  return window.location.origin
}
