import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "../../.env") })

const {
  FIRST_SUPERUSER,
  FIRST_SUPERUSER_PASSWORD,
  TEST_SUPERUSER_EMAIL,
  TEST_SUPERUSER_PASSWORD,
  VITE_API_URL,
} = process.env

if (typeof FIRST_SUPERUSER !== "string") {
  throw new Error("Environment variable FIRST_SUPERUSER is undefined")
}

if (typeof FIRST_SUPERUSER_PASSWORD !== "string") {
  throw new Error("Environment variable FIRST_SUPERUSER_PASSWORD is undefined")
}

export const firstSuperuser = FIRST_SUPERUSER as string
export const firstSuperuserPassword = FIRST_SUPERUSER_PASSWORD as string

/** API base URL for request context (e.g. auth setup, deleteUserAsSuperuser). */
export const apiBaseUrl =
  typeof VITE_API_URL === "string" && VITE_API_URL
    ? VITE_API_URL
    : "http://localhost:8000"

/**
 * Credentials for the test superuser created in auth setup.
 * Used for all tests that need superuser; the first superuser is only used once to create this user.
 */
export const testSuperuserEmail =
  typeof TEST_SUPERUSER_EMAIL === "string" && TEST_SUPERUSER_EMAIL
    ? TEST_SUPERUSER_EMAIL
    : "test-superuser@example.com"
export const testSuperuserPassword =
  typeof TEST_SUPERUSER_PASSWORD === "string" && TEST_SUPERUSER_PASSWORD
    ? TEST_SUPERUSER_PASSWORD
    : "test-superuser-password-min-8chars"
