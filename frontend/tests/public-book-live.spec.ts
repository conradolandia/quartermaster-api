import { expect, test } from "@playwright/test"

/**
 * Real E2E booking flow against a live backend.
 * Requires: backend + DB running, VITE_API_URL pointing at backend (e.g. http://localhost:8000).
 * Run with: E2E_USE_LIVE_BACKEND=1 npx playwright test public-book-live.spec.ts
 */
test.use({ storageState: { cookies: [], origins: [] } })

const skipLive =
  !process.env.E2E_USE_LIVE_BACKEND ||
  process.env.E2E_USE_LIVE_BACKEND !== "1"

test.describe("full booking flow (live backend)", () => {
  test.skip(
    skipLive,
    "Set E2E_USE_LIVE_BACKEND=1 and run backend to run this test",
  )

  test("complete free booking flow to confirmation page", async ({
    page,
  }) => {
    await page.goto("/book")

    // Step 1: Select mission, then trip, then boat (dropdowns)
    const noTrips = page.getByText("No Trips Available")
    const missionTrigger = page.getByRole("combobox", {
      name: /Select a mission|mission/i,
    }).or(page.getByText("Select a mission").first())
    await Promise.race([
      missionTrigger.waitFor({ state: "visible", timeout: 15000 }),
      noTrips.waitFor({ state: "visible", timeout: 15000 }),
    ])
    if (await noTrips.isVisible()) {
      test.skip(true, "No public trips available in backend")
      return
    }

    await missionTrigger.click()
    await page.getByRole("option").first().click()

    await page
      .getByRole("combobox", {
        name: /Select your rocket|trip|experience/i,
      })
      .or(page.getByText("Select your rocket viewing experience").first())
      .click()
    await page.getByRole("option").first().click()

    await page
      .getByRole("combobox", { name: /Select a boat|boat/i })
      .or(page.getByText("Select a boat").first())
      .click()
    await page.getByRole("option").first().click()

    await page.getByRole("button", { name: /Continue to Items/i }).click()

    // Step 2: Add at least one ticket (plus button for ticket type)
    const addTicket = page.getByRole("button", { name: /\\+|Add/i }).first()
    await addTicket.waitFor({ state: "visible", timeout: 8000 }).catch(() => {})
    await addTicket.click().catch(() => {})

    await page
      .getByRole("button", {
        name: /Continue to your information|Continue|Next/i,
      })
      .first()
      .click()

    // Step 3: Fill customer info
    await page.getByPlaceholder(/First name|first name/i).fill("E2E")
    await page.getByPlaceholder(/Last name|last name/i).fill("Live")
    await page.getByPlaceholder(/Email|email/i).fill("e2e-live@example.com")
    await page
      .getByRole("button", { name: /Continue to Review/i })
      .click()

    // Step 4: Draft is created automatically; for free booking we get redirect
    await expect(
      page.getByText(/Confirming your free booking|Preparing your booking/),
    ).toBeVisible({ timeout: 20000 })

    await page.waitForURL(/\/bookings\?.*code=/, {
      waitUntil: "commit",
      timeout: 15000,
    })
    await expect(page).toHaveURL(/\/bookings\?.*code=/)
  })
})
