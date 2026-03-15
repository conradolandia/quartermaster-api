import { expect, test } from "@playwright/test"
import { randomEmail } from "./utils/random"

const tabs = ["My profile", "Display", "Password"]

// User Information

test("My profile tab is active by default", async ({ page }) => {
  await page.goto("/settings")
  await expect(page.getByRole("tab", { name: "My profile" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
})

test("All tabs are visible", async ({ page }) => {
  await page.goto("/settings")
  for (const tab of tabs) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  }
})

// Edit tests share the same user; run serially to avoid conflicts.
test.describe.serial("Edit user", () => {
  test.describe("Edit user full name and email successfully", () => {
    test("Edit user name with a valid name", async ({ page }) => {
    const updatedName = `Test User ${randomEmail().slice(0, 8)}`
    await page.goto("/settings")
    await page.getByRole("tab", { name: "My profile" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Full name").fill(updatedName)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("User updated successfully.")).toBeVisible()
    await expect(
      page.getByRole("tabpanel", { name: "My profile" }).getByText(updatedName, { exact: true }),
    ).toBeVisible()
    })

    test("Edit user email with a valid email", async ({ page }) => {
    const updatedEmail = randomEmail()
    await page.goto("/settings")
    await page.getByRole("tab", { name: "My profile" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Email").fill(updatedEmail)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("User updated successfully.")).toBeVisible()
    await expect(
      page.getByRole("tabpanel", { name: "My profile" }).getByText(updatedEmail, { exact: true }),
    ).toBeVisible()
    })
  })

  test.describe("Edit user with invalid data", () => {
    test("Edit user email with an invalid email", async ({ page }) => {
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/settings/, { timeout: 10000 })
    await page.getByRole("tab", { name: "My profile" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Email").fill("")
    await page.locator("body").click()
    await expect(page.getByText("Email is required")).toBeVisible()
    })

    test("Cancel edit action restores original name", async ({ page }) => {
    const originalName = `Original ${randomEmail().slice(0, 8)}`
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/settings/, { timeout: 10000 })
    await page.getByRole("tab", { name: "My profile" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Full name").fill(originalName)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("User updated successfully.")).toBeVisible()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Full name").fill("Other Name")
    await page.getByRole("button", { name: "Cancel" }).first().click()
    await expect(
      page.getByRole("tabpanel", { name: "My profile" }).getByText(originalName, { exact: true }),
    ).toBeVisible()
    })

    test("Cancel edit action restores original email", async ({ page }) => {
    const originalEmail = randomEmail()
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/settings/, { timeout: 10000 })
    await page.getByRole("tab", { name: "My profile" }).click()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Email").fill(originalEmail)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("User updated successfully.")).toBeVisible()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Email").fill(randomEmail())
    await page.getByRole("button", { name: "Cancel" }).first().click()
    await expect(
      page.getByRole("tabpanel", { name: "My profile" }).getByText(originalEmail, { exact: true }),
    ).toBeVisible()
    })
  })
})

// Display

test("Display tab is visible", async ({ page }) => {
  await page.goto("/settings")
  await page.getByRole("tab", { name: "Display" }).click()
  await expect(page.getByRole("tabpanel", { name: "Display" })).toBeVisible()
})
