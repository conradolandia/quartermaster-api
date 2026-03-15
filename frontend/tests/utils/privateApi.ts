// Note: the `PrivateService` is only available when generating the client
// for local environments
import type { APIRequestContext } from "@playwright/test"
import { OpenAPI, PrivateService } from "../../src/client"
import {
  apiBaseUrl,
  firstSuperuser,
  firstSuperuserPassword,
} from "../config"

OpenAPI.BASE = `${process.env.VITE_API_URL}`

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  return await PrivateService.createUser({
    requestBody: {
      email,
      password,
      is_verified: true,
      full_name: "Test User",
    },
  })
}

/**
 * Delete a user by id using the first superuser (for test cleanup).
 * Never deletes the first superuser: we skip when the target user's email matches
 * FIRST_SUPERUSER.
 */
export async function deleteUserAsSuperuser(
  request: APIRequestContext,
  userId: string,
): Promise<void> {
  const loginRes = await request.post(`${apiBaseUrl}/api/v1/login/access-token`, {
    form: { username: firstSuperuser, password: firstSuperuserPassword },
  })
  if (!loginRes.ok()) {
    const body = await loginRes.text()
    throw new Error(
      `First superuser login failed: ${loginRes.status()}. ${body || "No response body."} Ensure backend is running and FIRST_SUPERUSER / FIRST_SUPERUSER_PASSWORD match.`,
    )
  }
  const body = (await loginRes.json()) as { access_token: string }
  const headers = { Authorization: `Bearer ${body.access_token}` }

  const meRes = await request.get(`${apiBaseUrl}/api/v1/users/me`, {
    headers,
  })
  if (!meRes.ok()) {
    throw new Error(`Get current user failed: ${meRes.status()}`)
  }
  const me = (await meRes.json()) as { id: string }
  if (String(me.id).toLowerCase() === String(userId).toLowerCase()) {
    return
  }

  const userRes = await request.get(`${apiBaseUrl}/api/v1/users/${userId}`, {
    headers,
  })
  if (userRes.ok()) {
    const user = (await userRes.json()) as { email?: string }
    if (
      user.email &&
      String(user.email).toLowerCase() === String(firstSuperuser).toLowerCase()
    ) {
      return
    }
  }

  const delRes = await request.delete(`${apiBaseUrl}/api/v1/users/${userId}`, {
    headers,
  })
  if (!delRes.ok()) {
    throw new Error(`Delete user failed: ${delRes.status()}`)
  }
}
