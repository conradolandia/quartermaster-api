import {
  type LaunchPublic,
  LaunchesService,
  type MissionPublic,
  MissionsService,
  type TripPublic,
  TripsService,
} from "@/client"

export async function importLaunch(file: File): Promise<LaunchPublic> {
  const formData = new FormData()
  formData.append("file", file)

  return LaunchesService.importLaunchFromYaml({
    formData: { file },
  })
}

export async function importMission(file: File): Promise<MissionPublic> {
  const formData = new FormData()
  formData.append("file", file)

  return MissionsService.importMissionFromYaml({
    formData: { file },
  })
}

export async function importTrip(file: File): Promise<TripPublic> {
  const formData = new FormData()
  formData.append("file", file)

  return TripsService.importTripFromYaml({
    formData: { file },
  })
}

export const YamlImportService = {
  importLaunch,
  importMission,
  importTrip,
}
