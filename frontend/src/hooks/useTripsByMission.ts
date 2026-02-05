import { TripsService } from "@/client"
import { useQuery } from "@tanstack/react-query"

export function useTripsByMission(missionId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ["trips", "mission", missionId],
    queryFn: () =>
      TripsService.readTripsByMission({
        missionId: missionId ?? "",
      }),
    enabled: enabled && !!missionId,
  })
  return {
    trips: query.data?.data ?? [],
    ...query,
  }
}
