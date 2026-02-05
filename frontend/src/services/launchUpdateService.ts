/**
 * Launch update (send-update) API. Sends an email to customers with confirmed
 * bookings for a launch, optionally scoped by mission or trip.
 */

export interface SendLaunchUpdateParams {
  message: string
  priority: boolean
  missionId?: string | null
  tripId?: string | null
}

export interface SendLaunchUpdateResponse {
  emails_sent: number
  emails_failed: number
  recipients: string[]
}

export async function sendLaunchUpdate(
  launchId: string,
  params: SendLaunchUpdateParams,
): Promise<SendLaunchUpdateResponse> {
  const search = new URLSearchParams()
  if (params.missionId) search.set("mission_id", params.missionId)
  if (params.tripId) search.set("trip_id", params.tripId)
  const qs = search.toString()
  const baseUrl =
    (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env
      ?.VITE_API_URL ?? ""
  const url = `${baseUrl}/api/v1/launches/${launchId}/send-update${qs ? `?${qs}` : ""}`
  const token = localStorage.getItem("access_token")
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: params.message,
      priority: params.priority,
    }),
  })
  if (!response.ok) {
    throw new Error("Failed to send launch update")
  }
  return response.json() as Promise<SendLaunchUpdateResponse>
}
