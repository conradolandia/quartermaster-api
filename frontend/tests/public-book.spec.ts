import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

const TRIP_ID = "trip-resume-test-123"
const CONFIRMATION_CODE = "TESTCODE1"
const NOW = "2025-06-01T12:00:00Z"

const draftBooking = {
  confirmation_code: CONFIRMATION_CODE,
  first_name: "Test",
  last_name: "User",
  user_email: "test@example.com",
  user_phone: "",
  billing_address: "",
  subtotal: 10000,
  discount_amount: 0,
  tax_amount: 0,
  tip_amount: 0,
  total_amount: 10000,
  special_requests: null,
  payment_status: null,
  booking_status: "draft",
  launch_updates_pref: false,
  discount_code_id: null,
  admin_notes: null,
  id: "booking-id-1",
  created_at: NOW,
  updated_at: NOW,
  items: [
    {
      booking_id: "booking-id-1",
      trip_id: TRIP_ID,
      boat_id: "boat-1",
      item_type: "ticket",
      quantity: 1,
      price_per_unit: 10000,
      id: "item-1",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
}

const confirmedBooking = {
  ...draftBooking,
  confirmation_code: "CONFIRMED1",
  booking_status: "confirmed",
}

const minimalTrip = {
  mission_id: "mission-1",
  type: "launch_viewing",
  name: "Test Trip",
  active: true,
  unlisted: false,
  archived: false,
  check_in_time: NOW,
  boarding_time: NOW,
  departure_time: NOW,
  id: TRIP_ID,
  created_at: NOW,
  updated_at: NOW,
}

test("resume draft by code (no trip in URL) shows step 4 and not No Trips Available", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/bookings\/[^/]+/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    const url = route.request().url()
    if (url.includes(CONFIRMATION_CODE)) {
      return route.fulfill({ status: 200, body: JSON.stringify(draftBooking) })
    }
    return route.fallback()
  })
  await page.route(/\/api\/v1\/trips\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [], count: 0 }),
    })
  })
  await page.route(new RegExp(`\\/api\\/v1\\/trips\\/public\\/${TRIP_ID}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify(minimalTrip),
    })
  })

  const bookingResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/bookings/") &&
      res.url().includes(CONFIRMATION_CODE) &&
      res.request().method() === "GET",
    { timeout: 15000 },
  )
  await page.goto(`/book?code=${CONFIRMATION_CODE}`)
  await bookingResponse

  await expect(page.getByText("Review & Pay")).toBeVisible({ timeout: 20000 })
  await expect(page.getByText("No Trips Available")).toBeHidden()
})

test("invalid booking code shows Booking Not Found and start new booking link", async ({
  page,
}) => {
  await page.route("**/api/v1/bookings/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({ status: 404, body: JSON.stringify({ detail: "Not found" }) })
  })

  await page.goto("/book?code=INVALIDCODE")

  await expect(page.getByText("Booking Not Found")).toBeVisible({ timeout: 10000 })
  await expect(
    page.getByRole("link", { name: "Start a new booking" }),
  ).toBeVisible()
})

test("confirmed booking by code redirects to confirmation page", async ({
  page,
}) => {
  await page.route("**/api/v1/bookings/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    const url = route.request().url()
    if (url.includes("CONFIRMED1")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(confirmedBooking),
      })
    }
    return route.fallback()
  })

  await page.goto("/book?code=CONFIRMED1")

  await page.waitForURL(/\/bookings\?.*code=CONFIRMED1/, { timeout: 10000 })
  await expect(page).toHaveURL(/\/bookings\?.*code=CONFIRMED1/)
})
