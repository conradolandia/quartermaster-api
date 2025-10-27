import {
  LaunchesService,
  MissionsService,
  TripsService,
  type LaunchPublic,
  type MissionPublic,
  type TripPublic,
} from "@/client"

/**
 * Service for importing YAML files into the system
 */
export class YamlImportService {
  /**
   * Import a launch from YAML file
   */
  static async importLaunch(file: File): Promise<LaunchPublic> {
    const formData = new FormData()
    formData.append("file", file)

    return LaunchesService.importLaunchFromYaml({
      formData: { file },
    })
  }

  /**
   * Import a mission from YAML file
   */
  static async importMission(file: File): Promise<MissionPublic> {
    const formData = new FormData()
    formData.append("file", file)

    return MissionsService.importMissionFromYaml({
      formData: { file },
    })
  }

  /**
   * Import a trip from YAML file
   */
  static async importTrip(file: File): Promise<TripPublic> {
    const formData = new FormData()
    formData.append("file", file)

    return TripsService.importTripFromYaml({
      formData: { file },
    })
  }
}
