import { type Page, expect } from "@playwright/test"

import {
  apiBaseUrl,
  firstSuperuser,
  firstSuperuserPassword,
  testSuperuserEmail,
  testSuperuserPassword,
} from "../config"

export async function signUpNewUser(
  page: Page,
  name: string,
  email: string,
  password: string,
) {
  await page.goto("/signup")

  await page.getByPlaceholder("Full Name").fill(name)
  await page.getByPlaceholder("Email").fill(email)
  await page.getByPlaceholder("Password", { exact: true }).fill(password)
  await page.getByPlaceholder("Confirm Password").fill(password)
  await page.getByRole("button", { name: "Sign Up" }).click()
  await page.goto("/login")
}

export async function logInUser(page: Page, email: string, password: string) {
  await page.goto("/login")

  await page.getByPlaceholder("Email").fill(email)
  await page.getByPlaceholder("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  try {
    await expect(page.getByTestId("user-menu")).toBeVisible({ timeout: 15000 })
  } catch {
    const errorMsg = await page
      .getByText(
        /Incorrect email or password|Incorrect password|Only superusers|Invalid email|Inactive user/,
      )
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(
      `Login failed: user-menu not visible. ${errorMsg ? `App message: ${errorMsg.trim()}` : "No error message on page."}`,
    )
  }
}

export async function logOutUser(page: Page) {
  await page.getByTestId("user-menu").click()
  await page.getByRole("menuitem", { name: "Log Out" }).click()
  await page.goto("/login")
}

/** Change password via API. Ensures same backend as login (avoids frontend proxy mismatch). */
export async function changePasswordViaApi(
  page: Page,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  if (!token) throw new Error("Change password failed: no access token in page")
  const res = await page.request.patch(`${apiBaseUrl}/api/v1/users/me/password`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: { current_password: currentPassword, new_password: newPassword },
  })
  if (!res.ok()) {
    throw new Error(`Change password failed: ${res.status()} ${await res.text()}`)
  }
}

/** Login via API and set token in page. Use when UI login is flaky (e.g. after password change). */
export async function logInUserViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const res = await page.request.post(`${apiBaseUrl}/api/v1/login/access-token`, {
    form: { username: email, password },
  })
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`API login failed: ${res.status()} ${body}`)
  }
  const { access_token } = (await res.json()) as { access_token: string }
  await page.evaluate(
    (token) => localStorage.setItem("access_token", token),
    access_token,
  )
  await page.goto("/")
  await expect(page.getByTestId("user-menu")).toBeVisible({ timeout: 5000 })
}

/** Reset test superuser password to known value. Use before tests that assume testSuperuserPassword. */
export async function resetTestSuperuserPassword(page: Page): Promise<void> {
  const loginRes = await page.request.post(
    `${apiBaseUrl}/api/v1/login/access-token`,
    {
      form: {
        username: firstSuperuser,
        password: firstSuperuserPassword,
      },
    },
  )
  if (!loginRes.ok()) {
    throw new Error(
      `Reset password failed: first superuser login returned ${loginRes.status()}`,
    )
  }
  const { access_token } = (await loginRes.json()) as { access_token: string }
  const usersRes = await page.request.get(`${apiBaseUrl}/api/v1/users/`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!usersRes.ok()) {
    throw new Error(`Reset password failed: list users returned ${usersRes.status()}`)
  }
  const { data: users } = (await usersRes.json()) as {
    data: Array<{ id: string; email: string }>
  }
  const user = users.find((u) => u.email === testSuperuserEmail)
  if (!user) {
    throw new Error("Reset password failed: test superuser not found")
  }
  const patchRes = await page.request.patch(
    `${apiBaseUrl}/api/v1/users/${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      data: { password: testSuperuserPassword },
    },
  )
  if (!patchRes.ok()) {
    throw new Error(
      `Reset password failed: PATCH user returned ${patchRes.status()}`,
    )
  }
}
