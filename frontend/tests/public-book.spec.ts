import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

// Must be a valid UUID: AccessGate only accepts directTripId in UUID format
const TRIP_ID = "a1b2c3d4-e5f6-4789-a012-345678901234";
const CONFIRMATION_CODE = "TESTCODE1";
const NOW = "2025-06-01T12:00:00Z";

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
};

const confirmedBooking = {
  ...draftBooking,
  confirmation_code: "CONFIRMED1",
  booking_status: "confirmed",
};

test("invalid booking code shows Booking Not Found and start new booking link", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/bookings\/[^/]+\/?(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not found" }),
    });
  });

  const responsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.url().includes("/api/v1/bookings/") &&
      res.url().includes("INVALIDCODE"),
    { timeout: 10000 },
  );
  await page.goto("/book?code=INVALIDCODE");
  await responsePromise;

  await expect(page.getByText("Booking Not Found")).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByRole("link", { name: "Start a new booking" }),
  ).toBeVisible();
});

test("confirmed booking by code redirects to confirmation page", async ({
  page,
}) => {
  await page.route("**/api/v1/bookings/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = route.request().url();
    if (url.includes("CONFIRMED1")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(confirmedBooking),
      });
    }
    return route.fallback();
  });

  await page.goto("/book?code=CONFIRMED1");

  await page.waitForURL(/\/bookings\?.*code=CONFIRMED1/, {
    waitUntil: "commit",
    timeout: 10000,
  });
  await expect(page).toHaveURL(/\/bookings\?.*code=CONFIRMED1/);
});

// Must be valid UUIDs: useBookingUrlSync only applies launch/trip/boat from URL when they pass UUID_RE
const HAPPY_PATH_LAUNCH_ID = "72487836-6b08-49ae-beed-0e9afcee26c4";
const HAPPY_PATH_TRIP_ID = "b2c3d4e5-f6a7-4890-b123-456789012345";
const HAPPY_PATH_BOAT_ID = "85d24db2-e66b-4447-8184-c566f4d3d921";

test("full happy path (mocked): step 1 through step 4 with free booking confirmation", async ({
  page,
}) => {
  const tripId = HAPPY_PATH_TRIP_ID;
  const launchId = HAPPY_PATH_LAUNCH_ID;
  const boatId = HAPPY_PATH_BOAT_ID;
  const code = "HAPPY1";
  const now = "2025-06-01T12:00:00Z";
  const launch = {
    id: launchId,
    name: "Mission Alpha Launch",
    launch_timestamp: now,
    summary: "",
    location_id: "loc-1",
  };
  const mission = {
    id: "m1",
    name: "Mission Alpha",
    archived: false,
    launch_id: launchId,
  };
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
  };
  const boat = { id: boatId, name: "Boat One", capacity: 10 };
  const createdBooking = {
    id: "book-1",
    confirmation_code: code,
    booking_status: "draft",
    total_amount: 0,
    first_name: "Happy",
    last_name: "User",
    user_email: "happy@example.com",
    items: [],
  };

  await page.route(/\/api\/v1\/launches\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [launch], count: 1 }),
    });
  });
  await page.route(/\/api\/v1\/missions\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [mission], count: 1 }),
    });
  });
  await page.route(/\/api\/v1\/trips\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [trip], count: 1 }),
    });
  });
  await page.route(
    new RegExp(`\\/api\\/v1\\/trips\\/public\\/${tripId}`),
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, body: JSON.stringify(trip) });
    },
  );
  const tripBoatWithAvailability = (
    t: string,
    b: { id: string; name: string },
  ) => ({
    trip_id: t,
    boat_id: b.id,
    max_capacity: 10,
    id: `tb-${b.id}`,
    created_at: now,
    updated_at: now,
    boat: {
      ...b,
      capacity: 10,
      provider_id: "p1",
      created_at: now,
      updated_at: now,
    },
    remaining_capacity: 10,
    sales_enabled: true,
    pricing: [{ ticket_type: "adult", price: 0, capacity: 10, remaining: 10 }],
  });
  await page.route(/\/api\/v1\/trip-boats\/public\/trip\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const urlTripId =
      route.request().url().split("/trip/")[1]?.split("?")[0] ?? tripId;
    return route.fulfill({
      status: 200,
      body: JSON.stringify([tripBoatWithAvailability(urlTripId, boat)]),
    });
  });
  await page.route(/\/api\/v1\/trip-boats\/public\/pricing/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify([
        { ticket_type: "adult", price: 0, capacity: 10, remaining: 10 },
      ]),
    });
  });
  await page.route(/\/api\/v1\/jurisdictions\/public\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({
        data: [
          { id: "j1", name: "Test", sales_tax_rate: 0, location_id: "loc-1" },
        ],
        count: 1,
      }),
    });
  });
  await page.route(/\/api\/v1\/bookings\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 201,
      body: JSON.stringify(createdBooking),
    });
  });
  await page.route(
    new RegExp(`\\/api\\/v1\\/bookings\\/${code}\\/confirm-free-booking`),
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 200, body: JSON.stringify({}) });
    },
  );

  await page.route(/\/api\/v1\/boats\/public\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = route.request().url();
    if (url.includes(boatId)) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(boat),
      });
    }
    return route.fallback();
  });
  await page.goto(`/book?launch=${launchId}&trip=${tripId}&boat=${boatId}`);
  await expect(
    page.getByRole("button", { name: /Continue to Items/i }),
  ).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole("button", { name: /Continue to Items/i }).click();
  await expect(page.getByText("Select Tickets & Merchandise")).toBeVisible({
    timeout: 8000,
  });

  const addBtn = page.getByRole("button", { name: /\+|Add/i }).first();
  if (await addBtn.isVisible()) await addBtn.click();

  await page
    .getByRole("button", { name: /Continue to .*[Ii]nformation/i })
    .click();
  await expect(
    page.getByRole("heading", { name: /Your Information/i }),
  ).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder(/First name|first name/i).fill("Happy");
  await page.getByPlaceholder(/Last name|last name/i).fill("User");
  await page.getByPlaceholder(/Email|email/i).fill("happy@example.com");
  await page.getByPlaceholder(/Phone|phone/i).fill("1234567890");
  await page
    .getByPlaceholder(/Billing address|billing address/i)
    .fill("123 Test St");
  await page.getByRole("checkbox", { name: /I agree to the terms/ }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Continue to Review/i }).click();

  await page.waitForURL(/\/bookings\?.*code=/, {
    waitUntil: "commit",
    timeout: 20000,
  });
  await expect(page).toHaveURL(/\/bookings\?.*code=/);
});

const FAIL_TRIP_ID = "c3d4e5f6-a7b8-4901-c234-567890123456";
const FAIL_LAUNCH_ID = "a1b2c3d4-e5f6-4789-a012-345678901234";
const FAIL_BOAT_ID = "d4e5f6a7-b8c9-4901-d234-567890123456";

test("booking creation failure shows error and does not leave step 4", async ({
  page,
}) => {
  const tripId = FAIL_TRIP_ID;
  const launchId = FAIL_LAUNCH_ID;
  const boatId = FAIL_BOAT_ID;
  const now = "2025-06-01T12:00:00Z";
  const launch = {
    id: launchId,
    name: "Fail Launch",
    launch_timestamp: now,
    summary: "",
    location_id: "loc-1",
  };
  const mission = {
    id: "m1",
    name: "M",
    archived: false,
    launch_id: launchId,
  };
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
  };

  await page.route(/\/api\/v1\/launches\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [launch], count: 1 }),
    });
  });
  await page.route(/\/api\/v1\/missions\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [mission], count: 1 }),
    });
  });
  await page.route(/\/api\/v1\/trips\/public\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ data: [trip], count: 1 }),
    });
  });
  await page.route(
    new RegExp(`\\/api\\/v1\\/trips\\/public\\/${tripId}`),
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, body: JSON.stringify(trip) });
    },
  );
  const failBoat = { id: boatId, name: "B" };
  const tripBoatWithAvailability = (
    t: string,
    b: { id: string; name: string },
  ) => ({
    trip_id: t,
    boat_id: b.id,
    max_capacity: 10,
    id: `tb-${b.id}`,
    created_at: now,
    updated_at: now,
    boat: {
      ...b,
      capacity: 10,
      provider_id: "p1",
      created_at: now,
      updated_at: now,
    },
    remaining_capacity: 10,
    sales_enabled: true,
    pricing: [{ ticket_type: "adult", price: 0, capacity: 10, remaining: 10 }],
  });
  await page.route(/\/api\/v1\/trip-boats\/public\/trip\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const urlTripId =
      route.request().url().split("/trip/")[1]?.split("?")[0] ?? tripId;
    return route.fulfill({
      status: 200,
      body: JSON.stringify([tripBoatWithAvailability(urlTripId, failBoat)]),
    });
  });
  await page.route(/\/api\/v1\/trip-boats\/public\/pricing/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify([
        { ticket_type: "adult", price: 0, capacity: 10, remaining: 10 },
      ]),
    });
  });
  await page.route(/\/api\/v1\/jurisdictions\/public\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      body: JSON.stringify({
        data: [
          { id: "j1", name: "Test", sales_tax_rate: 0, location_id: "loc-1" },
        ],
        count: 1,
      }),
    });
  });
  await page.route(/\/api\/v1\/bookings\/?(?=\?|$)/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const url = route.request().url();
    if (/\/api\/v1\/bookings\/[^/]+\//.test(url)) return route.fallback();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Internal server error" }),
    });
  });
  await page.route(/\/api\/v1\/boats\/public\//, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = route.request().url();
    if (url.includes(boatId)) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify(failBoat),
      });
    }
    return route.fallback();
  });

  await page.goto(`/book?launch=${launchId}&trip=${tripId}&boat=${boatId}`);
  await expect(
    page.getByRole("button", { name: /Continue to Items/i }),
  ).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole("button", { name: /Continue to Items/i }).click();
  const addBtn = page.getByRole("button", { name: /\+|Add/i }).first();
  if (await addBtn.isVisible()) await addBtn.click();
  await page
    .getByRole("button", { name: /Continue to .*[Ii]nformation/i })
    .click();
  await expect(
    page.getByRole("heading", { name: /Your Information/i }),
  ).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder(/First name|first name/i).fill("Fail");
  await page.getByPlaceholder(/Last name|last name/i).fill("User");
  await page.getByPlaceholder(/Email|email/i).fill("fail@example.com");
  await page.getByPlaceholder(/Phone|phone/i).fill("1234567890");
  await page
    .getByPlaceholder(/Billing address|billing address/i)
    .fill("123 Test St");
  await page.getByRole("checkbox", { name: /I agree to the terms/ }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Continue to Review/i }).click();

  await expect(
    page.getByRole("button", { name: /Back to Review/i }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Booking Creation Failed")).toBeVisible();
});
