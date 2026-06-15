import type { UserPublic } from "@/client"

export type UserRole = "admin" | "staff"

const STAFF_ALLOWED_PATHS = ["/check-in", "/settings"] as const

export function getUserRole(
  user: UserPublic | null | undefined,
): UserRole | undefined {
  const role = user?.role
  if (role === "admin" || role === "staff") {
    return role
  }
  return undefined
}

export function isAdmin(user: UserPublic | null | undefined): boolean {
  return getUserRole(user) === "admin"
}

export function isStaff(user: UserPublic | null | undefined): boolean {
  return getUserRole(user) === "staff"
}

export function isDashboardUser(user: UserPublic | null | undefined): boolean {
  return isAdmin(user) || isStaff(user)
}

export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string,
): boolean {
  if (!role) return false
  if (role === "admin") return true
  return STAFF_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  )
}

export function getDefaultHomePath(role: UserRole | undefined): string {
  if (role === "staff") return "/check-in"
  return "/"
}

export function formatUserRole(role: UserRole | undefined): string {
  if (role === "admin") return "Admin"
  if (role === "staff") return "Staff"
  return "Unknown"
}
