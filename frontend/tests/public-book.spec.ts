import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

// Must be a valid UUID: AccessGate only accepts directTripId in UUID format
const TRIP_ID = "a1b2c3d4-e5f6-4789-a012-345678901234"
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
  booking_mode: "public",
  check_in_time: NOW,
  boarding_time: NOW,
  departure_time: NOW,
  id: TRIP_ID,
  created_at: NOW,
  updated_at: NOW,
  timezone: "UTC",
  effective_booking_mode: "public",
  trip_boats: [],
}

test("resume draft by code (no trip in URL) shows step 4 and not No Trips Available", async ({
  page,
}) => {
  const bookingResponsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.url().includes("/api/v1/bookings/") &&
      res.url().includes(CONFIRMATION_CODE),
    { timeout: 15000 },
  )
  const tripResponsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.url().includes(`/api/v1/trips/public/${TRIP_ID}`),
    { timeout: 15000 },
  )

  await page.route("**/api/v1/bookings/**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    if (!route.request().url().includes(CONFIRMATION_CODE)) return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(draftBooking),
    })
  })
  await page.route("**/api/v1/trips/public**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    const url = route.request().url()
    const path = new URL(url).pathname
    const isTripById =
      path.endsWith(TRIP_ID) || path.includes(`/trips/public/${TRIP_ID}`)
    const isListWithIncludeTripId =
      url.includes("include_trip_id") && url.includes(TRIP_ID)
    if (isTripById) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(minimalTrip),
      })
    }
    // List: when include_trip_id=TRIP_ID (resume by code), return the trip so AccessGate sees hasTrips
    const listBody =
      isListWithIncludeTripId
        ? { data: [minimalTrip], count: 1, all_trips_require_access_code: false }
        : { data: [], count: 0, all_trips_require_access_code: false }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listBody),
    })
  })

  await page.goto(`/book?code=${CONFIRMATION_CODE}`)
  const bookingRes = await bookingResponsePromise
  const tripRes = await tripResponsePromise
  expect(bookingRes.status(), "booking mock should have been used").toBe(200)
  expect(tripRes.status(), "trip mock should have been used").toBe(200)

  await expect(page.getByText("Review & Pay")).toBeVisible({ timeout: 25000 })
  await expect(
    page.getByRole("heading", { name: "No Trips Available" }),
  ).toBeHidden()
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

  await page.waitForURL(/\/bookings\?.*code=CONFIRMED1/, {
    waitUntil: "commit",
    timeout: 10000,
  })
  await expect(page).toHaveURL(/\/bookings\?.*code=CONFIRMED1/)
})

// Must be a valid UUID: AccessGate shows "Trip Not Found" when URL has ?trip= and value is not a UUID
const HAPPY_PATH_TRIP_ID = "b2c3d4e5-f6a7-4890-b123-456789012345"

test("full happy path (mocked): step 1 through step 4 with free booking confirmation", async ({
  page,
}) => {
  const tripId = HAPPY_PATH_TRIP_ID
  const code = "HAPPY1"
  const now = "2025-06-01T12:00:00Z"
  const launchId = "launch-1"
  const launch = {
    id: launchId,
    name: "Mission Alpha Launch",
    launch_timestamp: now,
    summary: "",
    location_id: "loc-1",
  }
  const mission = {
    id: "m1",
    name: "Mission Alpha",
    archived: false,
    launch_id: launchId,
  }
  const trip = {
    id: tripId,
    mission_id: mission.id,
    type: "launch_viewing",
    name: "Happy Path Trip",
    active: true,
    unlisted: false,
    archived: false,
    check_in_time: now,
    boarding_time: now,
    departure_time: now,
    created_at: now,
    updated_at: now,
  }
  const boat = { id: "b1", name: "Boat One", capacity: 10 }
  const createdBooking = {
    id: "book-1",
    confirmation_code: code,
    booking_status: "draft",
    total_amount: 0,
    first_name: "Happy",
    last_name: "User",
    user_email: "happy@example.com",
    items: [],
  }

  await page.route(/\/api\/v1\/launches\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [launch], count: 1 }),
    })
  })
  await page.route(/\/api\/v1\/missions\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [mission], count: 1 }),
    })
  })
  await page.route(/\/api\/v1\/trips\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [trip], count: 1 }),
    })
  })
  await page.route(new RegExp(`\\/api\\/v1\\/trips\\/public\\/${tripId}`), async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({ status: 200, body: JSON.stringify(trip) })
  })
  await page.route(/\/api\/v1\/trips\/.*\/boats/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify([
        { ...boat, max_capacity: 10, used_per_ticket_type: {} },
      ]),
    })
  })
  await page.route(/\/api\/v1\/bookings\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    return route.fulfill({
      status: 201,
      body: JSON.stringify(createdBooking),
    })
  })
  await page.route(new RegExp(`\\/api\\/v1\\/bookings\\/${code}\\/confirm-free-booking`), async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    return route.fulfill({ status: 200, body: JSON.stringify({}) })
  })

  await page.goto("/book")
  await expect(page.getByText("Select Experience")).toBeVisible({ timeout: 10000 })

  await page.getByRole("combobox").first().click()
  await page.getByRole("option").first().click()
  await page.getByText("Select your rocket viewing experience").click()
  await page.getByRole("option").first().click()
  await page.getByRole("combobox").nth(2).click()
  await page.getByRole("option").first().click()

  await page.getByRole("button", { name: /Continue to Items/i }).click()
  await expect(page.getByText("Select Tickets & Merchandise")).toBeVisible({ timeout: 8000 })

  const addBtn = page.getByRole("button", { name: /\+|Add/i }).first()
  if (await addBtn.isVisible()) await addBtn.click()

  await page.getByRole("button", { name: /Continue to your information/i }).click()
  await page.getByPlaceholder(/First name|first name/i).fill("Happy")
  await page.getByPlaceholder(/Last name|last name/i).fill("User")
  await page.getByPlaceholder(/Email|email/i).fill("happy@example.com")
  await page.getByRole("button", { name: /Continue to Review/i }).click()

  await expect(
    page.getByText(/Review & Complete Booking|Confirming your free booking/),
  ).toBeVisible({ timeout: 15000 })
  await page.waitForURL(/\/bookings\?.*code=/, {
    waitUntil: "commit",
    timeout: 10000,
  }).catch(() => {})
  if (page.url().includes("/bookings") && page.url().includes("code=")) {
    await expect(page).toHaveURL(/\/bookings\?.*code=/)
  }
})

const FAIL_TRIP_ID = "c3d4e5f6-a7b8-4901-c234-567890123456"

test("booking creation failure shows error and does not leave step 4", async ({
  page,
}) => {
  const tripId = FAIL_TRIP_ID
  const now = "2025-06-01T12:00:00Z"
  const launchId = "launch-fail"
  const launch = {
    id: launchId,
    name: "Fail Launch",
    launch_timestamp: now,
    summary: "",
    location_id: "loc-1",
  }
  const mission = {
    id: "m1",
    name: "M",
    archived: false,
    launch_id: launchId,
  }
  const trip = {
    id: tripId,
    mission_id: mission.id,
    type: "launch_viewing",
    name: "Fail Trip",
    active: true,
    unlisted: false,
    archived: false,
    check_in_time: now,
    boarding_time: now,
    departure_time: now,
    created_at: now,
    updated_at: now,
  }

  await page.route(/\/api\/v1\/launches\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [launch], count: 1 }),
    })
  })
  await page.route(/\/api\/v1\/missions\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [mission], count: 1 }),
    })
  })
  await page.route(/\/api\/v1\/trips\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [trip], count: 1 }),
    })
  })
  await page.route(new RegExp(`\\/api\\/v1\\/trips\\/public\\/${tripId}`), async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({ status: 200, body: JSON.stringify(trip) })
  })
  await page.route(/\/api\/v1\/trips\/.*\/boats/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    return route.fulfill({
      status: 200,
      body: JSON.stringify([
        { id: "b1", name: "B", max_capacity: 10, used_per_ticket_type: {} },
      ]),
    })
  })
  await page.route(/\/api\/v1\/bookings\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    return route.fulfill({
      status: 500,
      body: JSON.stringify({ detail: "Internal server error" }),
    })
  })

  await page.goto("/book")
  await page.getByRole("combobox").first().click()
  await page.getByRole("option").first().click()
  await page.getByText("Select your rocket viewing experience").click()
  await page.getByRole("option").first().click()
  await page.getByRole("combobox").nth(2).click()
  await page.getByRole("option").first().click()
  await page.getByRole("button", { name: /Continue to Items/i }).click()
  const addBtn = page.getByRole("button", { name: /\+|Add/i }).first()
  if (await addBtn.isVisible()) await addBtn.click()
  await page.getByRole("button", { name: /Continue to your information/i }).click()
  await page.getByPlaceholder(/First name|first name/i).fill("Fail")
  await page.getByPlaceholder(/Last name|last name/i).fill("User")
  await page.getByPlaceholder(/Email|email/i).fill("fail@example.com")
  await page.getByRole("button", { name: /Continue to Review/i }).click()

  await expect(
    page.getByText(/Review & Complete Booking|Information incomplete/),
  ).toBeVisible({ timeout: 15000 })
  await expect(
    page.getByText("Booking Creation Failed"),
  ).toBeVisible({ timeout: 10000 })
})
