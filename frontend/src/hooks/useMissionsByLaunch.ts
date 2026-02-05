import { MissionsService } from "@/client"
import { useQuery } from "@tanstack/react-query"

export function useMissionsByLaunch(launchId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ["missions", "launch", launchId],
    queryFn: () =>
      MissionsService.readMissionsByLaunch({ launchId: launchId ?? "" }),
    enabled: enabled && !!launchId,
  })
  return {
    missions: query.data?.data ?? [],
    ...query,
  }
}
