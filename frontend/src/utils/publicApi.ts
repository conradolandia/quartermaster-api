/**
 * Public API utilities for unauthenticated requests
 */

import { OpenAPI } from "@/client"

export interface PublicLaunch {
  id: string
  name: string
  launch_timestamp: string
  summary: string
  location_id: string
  created_at: string
  updated_at: string
}

export interface PublicLaunchesResponse {
  data: PublicLaunch[]
  count: number
}

export interface PublicMission {
  id: string
  name: string
  launch_id: string
  active: boolean
  public: boolean
  refund_cutoff_hours: number | null
  created_at: string
  updated_at: string
}

export interface PublicMissionsResponse {
  data: PublicMission[]
  count: number
}

export interface PublicTrip {
  id: string
  name: string
  mission_id: string
  active: boolean
  sales_open_at: string | null
  created_at: string
  updated_at: string
}

export interface PublicTripsResponse {
  data: PublicTrip[]
  count: number
}

/**
 * Fetch public launches without authentication
 */
export const fetchPublicLaunches = async (
  params: { skip?: number; limit?: number } = {},
): Promise<PublicLaunchesResponse> => {
  const searchParams = new URLSearchParams()
  if (params.skip !== undefined)
    searchParams.set("skip", params.skip.toString())
  if (params.limit !== undefined)
    searchParams.set("limit", params.limit.toString())

  const url = `${
    OpenAPI.BASE
  }/api/v1/launches/public/?${searchParams.toString()}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch launches: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

/**
 * Fetch public missions without authentication
 */
export const fetchPublicMissions = async (
  params: { skip?: number; limit?: number } = {},
): Promise<PublicMissionsResponse> => {
  const searchParams = new URLSearchParams()
  if (params.skip !== undefined)
    searchParams.set("skip", params.skip.toString())
  if (params.limit !== undefined)
    searchParams.set("limit", params.limit.toString())

  const url = `${
    OpenAPI.BASE
  }/api/v1/missions/public/?${searchParams.toString()}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch missions: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

/**
 * Fetch public trips without authentication
 */
export const fetchPublicTrips = async (
  params: { skip?: number; limit?: number } = {},
): Promise<PublicTripsResponse> => {
  const searchParams = new URLSearchParams()
  if (params.skip !== undefined)
    searchParams.set("skip", params.skip.toString())
  if (params.limit !== undefined)
    searchParams.set("limit", params.limit.toString())

  const url = `${OpenAPI.BASE}/api/v1/trips/public/?${searchParams.toString()}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trips: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}
