import { createListCollection } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

import {
  BoatsService,
  LaunchesService,
  MissionsService,
  type TripBoatPublicWithAvailability,
  TripBoatsService,
  type TripPublic,
  TripsService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import {
  formatDateTimeNoSeconds,
  formatInLocationTimezoneWithAbbr,
  parseApiDate,
} from "@/utils"

import type { BookingStepData } from "../bookingTypes"

interface UseStep1QueriesArgs {
  bookingData: BookingStepData
  updateBookingData: (updates: Partial<BookingStepData>) => void
  accessCode?: string | null
}

export function useStep1Queries({
  bookingData,
  updateBookingData,
  accessCode,
}: UseStep1QueriesArgs) {
  const { showErrorToast } = useCustomToast()

  // --- Queries ---

  const { data: launchesResponse, isLoading: isLoadingLaunches } = useQuery({
    queryKey: ["public-launches"],
    queryFn: () => LaunchesService.readPublicLaunches({ limit: 100 }),
  })

  const {
    data: missionsResponse,
    isLoading: isLoadingMissions,
    isFetching: isFetchingMissions,
  } = useQuery({
    queryKey: ["public-missions"],
    queryFn: () => MissionsService.readPublicMissions({ limit: 500 }),
  })

  const launches = launchesResponse?.data ?? []
  const missions = missionsResponse?.data ?? []

  const {
    data: allTrips,
    isLoading: isLoadingTrips,
    isFetching: isFetchingTrips,
  } = useQuery({
    queryKey: ["public-trips", accessCode, bookingData.selectedTripId],
    queryFn: () =>
      TripsService.readPublicTrips({
        limit: 100,
        accessCode: accessCode || undefined,
        includeTripId: bookingData.selectedTripId || undefined,
      }),
  })

  const {
    data: directLinkTrip,
    isLoading: isLoadingDirectTrip,
    isError: isDirectLinkTripError,
  } = useQuery({
    queryKey: ["public-trip", bookingData.selectedTripId, accessCode],
    queryFn: () =>
      TripsService.readPublicTrip({
        tripId: bookingData.selectedTripId,
        accessCode: accessCode || undefined,
      }),
    enabled:
      !!bookingData.selectedTripId &&
      !!allTrips &&
      !allTrips.data?.some(
        (t: TripPublic) => t.id === bookingData.selectedTripId,
      ),
  })

  const { data: tripBoatsResponse, isLoading: isLoadingBoats } = useQuery({
    queryKey: ["public-trip-boats", bookingData.selectedTripId],
    queryFn: () =>
      TripBoatsService.readPublicTripBoatsByTrip({
        tripId: bookingData.selectedTripId,
      }),
    enabled: !!bookingData.selectedTripId,
  })

  const tripBoats: TripBoatPublicWithAvailability[] = Array.isArray(
    tripBoatsResponse,
  )
    ? tripBoatsResponse
    : []

  const { data: boatNames, isLoading: isLoadingBoatNames } = useQuery({
    queryKey: ["public-boat-names", tripBoats.map((tb) => tb.boat_id)],
    queryFn: async () => {
      if (!tripBoats || tripBoats.length === 0) return {}
      const names: Record<string, string> = {}
      await Promise.all(
        tripBoats.map(async (tripBoat) => {
          try {
            const boat = await BoatsService.readPublicBoat({
              boatId: tripBoat.boat_id,
            })
            names[tripBoat.boat_id] = boat.name
          } catch {
            names[tripBoat.boat_id] = "Unknown Boat"
          }
        }),
      )
      return names
    },
    enabled: !!tripBoats && tripBoats.length > 0,
  })

  // --- Computed values ---

  const missionIdsForLaunch = React.useMemo(() => {
    if (!bookingData.selectedLaunchId) return new Set<string>()
    return new Set(
      missions
        .filter(
          (m: { launch_id: string }) =>
            m.launch_id === bookingData.selectedLaunchId,
        )
        .map((m: { id: string }) => m.id),
    )
  }, [bookingData.selectedLaunchId, missions])

  const activeTrips = React.useMemo(() => {
    const fromList = allTrips?.data ?? []
    const base = fromList.filter(
      (trip: TripPublic) =>
        trip.active === true &&
        (!bookingData.selectedLaunchId ||
          missionIdsForLaunch.has(trip.mission_id)),
    )
    if (
      directLinkTrip &&
      directLinkTrip.active === true &&
      (!bookingData.selectedLaunchId ||
        missionIdsForLaunch.has(directLinkTrip.mission_id)) &&
      !base.some((t: TripPublic) => t.id === directLinkTrip.id)
    ) {
      return [...base, directLinkTrip]
    }
    return base
  }, [
    allTrips?.data,
    directLinkTrip,
    bookingData.selectedLaunchId,
    missionIdsForLaunch,
  ])

  const isTripSoldOut = React.useMemo(() => {
    if (!bookingData.selectedTripId || !tripBoats || tripBoats.length === 0)
      return false
    return tripBoats.every((tb) => tb.remaining_capacity <= 0)
  }, [bookingData.selectedTripId, tripBoats])

  const isTripPaused = React.useMemo(() => {
    if (!bookingData.selectedTripId || !tripBoats || tripBoats.length === 0)
      return false
    return tripBoats.every((tb) => tb.sales_enabled === false)
  }, [bookingData.selectedTripId, tripBoats])

  const availableBoats = React.useMemo(() => {
    return (
      tripBoats?.filter(
        (tb) =>
          tb.sales_enabled !== false && (tb.remaining_capacity ?? 0) > 0,
      ) ?? []
    )
  }, [tripBoats])

  const launchIdsWithVisibleTrips = React.useMemo(() => {
    const ids = new Set<string>()
    for (const trip of allTrips?.data ?? []) {
      const mission = missions.find(
        (m: { id: string }) => m.id === trip.mission_id,
      )
      if (mission?.launch_id) ids.add(mission.launch_id)
    }
    if (directLinkTrip) {
      const mission = missions.find(
        (m: { id: string }) => m.id === directLinkTrip.mission_id,
      )
      if (mission?.launch_id) ids.add(mission.launch_id)
    }
    return ids
  }, [allTrips?.data, directLinkTrip, missions])

  const visibleLaunches = React.useMemo(() => {
    return [...launches]
      .filter((l) => launchIdsWithVisibleTrips.has(l.id))
      .sort(
        (a, b) =>
          new Date(a.launch_timestamp).getTime() -
          new Date(b.launch_timestamp).getTime(),
      )
  }, [launches, launchIdsWithVisibleTrips])

  const canProceed =
    bookingData.selectedLaunchId &&
    bookingData.selectedTripId &&
    !isTripSoldOut &&
    !isTripPaused &&
    (bookingData.selectedBoatId || availableBoats.length === 1)

  /**
   * Trip Select must not go "ready" with an empty collection: Ark Select will not open
   * when items.length === 0 (looks broken). Wait while queries are in flight or while we
   * still have zero filtered trips but a fetch is in progress (missions/trips race).
   */
  const tripOptionsPending = React.useMemo(() => {
    if (!bookingData.selectedLaunchId) return false
    if (isLoadingTrips || isLoadingMissions) return true
    if (
      activeTrips.length === 0 &&
      (isFetchingTrips || isFetchingMissions)
    ) {
      return true
    }
    return false
  }, [
    bookingData.selectedLaunchId,
    isLoadingTrips,
    isLoadingMissions,
    isFetchingTrips,
    isFetchingMissions,
    activeTrips.length,
  ])

  // --- Effects ---

  // Derive launch from trip's mission when resuming
  React.useEffect(() => {
    if (
      !bookingData.selectedTripId ||
      bookingData.selectedLaunchId ||
      missions.length === 0
    )
      return
    const tripFromList = allTrips?.data?.find(
      (t: TripPublic) => t.id === bookingData.selectedTripId,
    )
    const trip =
      tripFromList ??
      (directLinkTrip &&
      bookingData.selectedTripId === directLinkTrip.id
        ? directLinkTrip
        : null)
    const mission =
      trip &&
      missions.find((m: { id: string }) => m.id === trip.mission_id)
    if (mission) {
      updateBookingData({ selectedLaunchId: mission.launch_id })
    }
  }, [
    bookingData.selectedTripId,
    bookingData.selectedLaunchId,
    allTrips?.data,
    directLinkTrip,
    missions,
    updateBookingData,
  ])

  // Auto-select first boat with capacity
  React.useEffect(() => {
    if (
      bookingData.selectedTripId &&
      tripBoats &&
      tripBoats.length > 0 &&
      !bookingData.selectedBoatId
    ) {
      const firstWithCapacity = tripBoats.find(
        (tb) => tb.remaining_capacity > 0,
      )
      if (firstWithCapacity) {
        updateBookingData({
          selectedBoatId: firstWithCapacity.boat_id,
          boatRemainingCapacity: firstWithCapacity.remaining_capacity,
        })
      }
    }
  }, [
    bookingData.selectedTripId,
    tripBoats,
    bookingData.selectedBoatId,
    updateBookingData,
  ])

  // Keep boatRemainingCapacity in sync; clear when boat has no capacity
  React.useEffect(() => {
    if (!bookingData.selectedBoatId || !tripBoats?.length) return
    const selected = tripBoats.find(
      (tb) => String(tb.boat_id) === String(bookingData.selectedBoatId),
    )
    if (selected && selected.remaining_capacity <= 0) {
      showErrorToast(
        "This boat has no remaining capacity. Please choose another boat.",
      )
      updateBookingData({ selectedBoatId: "", boatRemainingCapacity: null })
      return
    }
    const remaining = selected?.remaining_capacity ?? null
    if (remaining !== bookingData.boatRemainingCapacity) {
      updateBookingData({ boatRemainingCapacity: remaining })
    }
  }, [
    bookingData.selectedBoatId,
    bookingData.boatRemainingCapacity,
    tripBoats,
    updateBookingData,
    showErrorToast,
  ])

  // Clear launch when no longer available
  React.useEffect(() => {
    if (
      isLoadingLaunches ||
      isLoadingMissions ||
      isLoadingTrips ||
      !bookingData.selectedLaunchId ||
      visibleLaunches.some((l) => l.id === bookingData.selectedLaunchId)
    )
      return
    queueMicrotask(() => {
      showErrorToast(
        "The selected launch is no longer available. Please choose another.",
      )
      updateBookingData({
        selectedLaunchId: "",
        selectedTripId: "",
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
    })
  }, [
    bookingData.selectedLaunchId,
    visibleLaunches,
    updateBookingData,
    showErrorToast,
    isLoadingLaunches,
    isLoadingMissions,
    isLoadingTrips,
  ])

  // Clear trip when no longer available
  React.useEffect(() => {
    if (
      isLoadingTrips ||
      isLoadingMissions ||
      isLoadingDirectTrip ||
      !bookingData.selectedTripId ||
      activeTrips.some(
        (t: TripPublic) => t.id === bookingData.selectedTripId,
      )
    )
      return
    const message = isDirectLinkTripError
      ? "This trip is no longer available. It may have already departed or the launch for this mission may have already occurred."
      : "The selected trip is not available for this launch. Please choose another."
    queueMicrotask(() => {
      showErrorToast(message)
      updateBookingData({
        selectedTripId: "",
        selectedBoatId: "",
        boatRemainingCapacity: null,
      })
    })
  }, [
    bookingData.selectedTripId,
    activeTrips,
    updateBookingData,
    showErrorToast,
    isLoadingTrips,
    isLoadingMissions,
    isLoadingDirectTrip,
    isDirectLinkTripError,
  ])

  // Clear boat when not on trip
  React.useEffect(() => {
    if (
      !bookingData.selectedTripId ||
      !bookingData.selectedBoatId ||
      isLoadingBoats
    )
      return
    const selected = tripBoats.find(
      (tb) => String(tb.boat_id) === String(bookingData.selectedBoatId),
    )
    if (selected) return
    queueMicrotask(() => {
      showErrorToast(
        "The selected boat is not available for this trip. Please choose another.",
      )
      updateBookingData({ selectedBoatId: "", boatRemainingCapacity: null })
    })
  }, [
    bookingData.selectedTripId,
    bookingData.selectedBoatId,
    tripBoats,
    isLoadingBoats,
    updateBookingData,
    showErrorToast,
  ])

  // --- Handlers ---

  const handleLaunchChange = (details: { value: string[] }) => {
    const launchId = details.value[0] || ""
    updateBookingData({
      selectedLaunchId: launchId,
      selectedTripId: "",
      selectedBoatId: "",
      boatRemainingCapacity: null,
    })
  }

  const handleTripChange = (details: { value: string[] }) => {
    const tripId = details.value[0] || ""
    updateBookingData({
      selectedTripId: tripId,
      selectedBoatId: "",
      boatRemainingCapacity: null,
    })
  }

  const handleBoatChange = (details: { value: string[] }) => {
    const boatId = details.value[0] || ""
    const selected = tripBoats?.find(
      (tb) => String(tb.boat_id) === String(boatId),
    )
    updateBookingData({
      selectedBoatId: boatId,
      boatRemainingCapacity: selected?.remaining_capacity ?? null,
    })
  }

  // --- Format helpers ---

  const formatTripTime = (dateString: string, timezone?: string | null) => {
    const d = parseApiDate(dateString)
    const parts = timezone
      ? formatInLocationTimezoneWithAbbr(d, timezone)
      : null
    if (parts) return `${parts.dateTime} ${parts.timezoneAbbr}`
    return formatDateTimeNoSeconds(d)
  }

  const tripTypeToLabel = (type: string): string => {
    if (type === "launch_viewing") return "Launch Viewing"
    if (type === "pre_launch") return "Pre-Launch"
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatTripOptionLabel = (trip: TripPublic): string => {
    const readableType = tripTypeToLabel(trip.type)
    const time = formatTripTime(trip.departure_time, trip.timezone)
    if (trip.name?.trim()) {
      return `${trip.name.trim()} - ${readableType} (${time})`
    }
    return `${readableType} (${time})`
  }

  const formatLaunchOptionLabel = (launch: { name: string }): string => {
    return launch.name?.trim() || "Mission"
  }

  // --- Collections ---

  const launchesCollection = React.useMemo(
    () =>
      createListCollection({
        items: visibleLaunches.map((launch) => ({
          label: formatLaunchOptionLabel(launch),
          value: launch.id,
        })),
      }),
    [visibleLaunches],
  )

  const tripsCollection = React.useMemo(
    () =>
      createListCollection({
        items: activeTrips.map((trip: TripPublic) => ({
          label: formatTripOptionLabel(trip),
          value: trip.id,
        })),
      }),
    [activeTrips],
  )

  const boatsCollection = createListCollection({
    items:
      availableBoats.map((tripBoat: TripBoatPublicWithAvailability) => {
        const name =
          tripBoat.boat?.name ||
          boatNames?.[tripBoat.boat_id] ||
          "Loading..."
        return {
          label: `${name} (${tripBoat.remaining_capacity} spots left)`,
          value: tripBoat.boat_id,
        }
      }) || [],
  })

  return {
    // Data
    launches,
    allTrips,
    directLinkTrip,
    tripBoats,
    boatNames,
    activeTrips,
    visibleLaunches,
    availableBoats,
    // Loading
    isLoadingLaunches,
    isLoadingTrips,
    isLoadingMissions,
    isLoadingBoats,
    isLoadingBoatNames,
    // Computed
    isTripSoldOut,
    isTripPaused,
    canProceed,
    tripOptionsPending,
    // Handlers
    handleLaunchChange,
    handleTripChange,
    handleBoatChange,
    // Collections
    launchesCollection,
    tripsCollection,
    boatsCollection,
    // Helpers
    formatTripTime,
    tripTypeToLabel,
    formatLaunchOptionLabel,
  }
}
