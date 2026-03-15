import { test as setup } from "@playwright/test"
import {
  apiBaseUrl,
  firstSuperuser,
  firstSuperuserPassword,
  testSuperuserEmail,
  testSuperuserPassword,
} from "./config.ts"

const authFile = "playwright/.auth/user.json"

setup("authenticate", async ({ page, request }) => {
  const loginRes = await request.post(`${apiBaseUrl}/api/v1/login/access-token`, {
    form: {
      username: firstSuperuser,
      password: firstSuperuserPassword,
    },
  })
  if (!loginRes.ok()) {
    throw new Error(
      `Auth setup failed: first superuser login returned ${loginRes.status()}. Ensure backend is running and FIRST_SUPERUSER / FIRST_SUPERUSER_PASSWORD match.`,
    )
  }
  const { access_token: token } = (await loginRes.json()) as {
    access_token: string
  }

  const createRes = await request.post(`${apiBaseUrl}/api/v1/users/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      email: testSuperuserEmail,
      password: testSuperuserPassword,
      is_superuser: true,
      full_name: "Test Superuser",
    },
  })
  if (!createRes.ok()) {
    const body = await createRes.text()
    if (createRes.status() !== 400 || !body.includes("already exists")) {
      throw new Error(
        `Auth setup failed: create test superuser returned ${createRes.status()}: ${body}`,
      )
    }
    // User exists from a previous run (e.g. password was changed). Reset password.
    const usersRes = await request.get(`${apiBaseUrl}/api/v1/users/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!usersRes.ok()) {
      throw new Error(
        `Auth setup failed: list users returned ${usersRes.status()}`,
      )
    }
    const { data: users } = (await usersRes.json()) as {
      data: Array<{ id: string; email: string }>
    }
    const existing = users.find((u) => u.email === testSuperuserEmail)
    if (!existing) {
      throw new Error("Auth setup failed: test superuser not found after create conflict")
    }
    const resetRes = await request.patch(
      `${apiBaseUrl}/api/v1/users/${existing.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { password: testSuperuserPassword },
      },
    )
    if (!resetRes.ok()) {
      throw new Error(
        `Auth setup failed: reset test superuser password returned ${resetRes.status()}`,
      )
    }
  }

  await page.goto("/login")
  await page.getByPlaceholder("Email").fill(testSuperuserEmail)
  await page.getByPlaceholder("Password").fill(testSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()
  try {
    await page.waitForURL("/", { waitUntil: "commit", timeout: 15000 })
  } catch {
    const errorMsg = await page
      .getByText(/Incorrect email or password|Only superusers|Invalid email|Inactive user/)
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(
      `Auth setup failed: test superuser login did not reach /. ${errorMsg ? `App message: ${errorMsg.trim()}` : "No error message on page."}`,
    )
  }
  await page.context().storageState({ path: authFile })
})
