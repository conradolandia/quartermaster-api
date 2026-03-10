import { expect, test } from "@playwright/test"

/**
 * Admin dashboard smoke tests. Use the authenticated project (storageState from setup).
 */

test("Trips list page loads", async ({ page }) => {
  await page.goto("/trips")
  await expect(
    page.getByRole("heading", { name: /Trips Management/i }),
  ).toBeVisible({ timeout: 10000 })
})

test("Bookings list page loads", async ({ page }) => {
  await page.goto("/bookings")
  await expect(
    page.getByRole("heading", { name: /Bookings/i }),
  ).toBeVisible({ timeout: 10000 })
})

test("Check-in page loads", async ({ page }) => {
  await page.goto("/check-in")
  await expect(
    page.getByRole("heading", { name: /Check-In Management/i }),
  ).toBeVisible({ timeout: 10000 })
})

test("Bookings page shows table or empty state", async ({ page }) => {
  await page.goto("/bookings")
  await expect(
    page.getByRole("heading", { name: /Bookings Management/i }),
  ).toBeVisible({ timeout: 10000 })
  await expect(
    page.getByText(/No bookings|Confirmation|Search/i).or(page.locator("table")).first(),
  ).toBeVisible({ timeout: 8000 })
})
