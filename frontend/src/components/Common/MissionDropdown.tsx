import { RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { MissionsService } from "@/client"

interface MissionDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const MissionDropdown = ({
  value,
  onChange,
  id,
  isDisabled,
  portalRef,
  ...props
}: MissionDropdownProps) => {
  // Use React Query to fetch missions
  const {
    data: missionsResponse,
    isLoading,
  } = useQuery({
    queryKey: ["missions-dropdown"],
    queryFn: () => {
      try {
        return MissionsService.readMissions()
      } catch (error) {
        console.error("Error fetching missions:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1
  })

  // Create a collection from the API response
  const missionsCollection = createListCollection({
    items: missionsResponse?.data?.map(mission => ({
      label: mission.name,
      value: mission.id
    })) || []
  })

  return (
    <Select.Root
      collection={missionsCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Select mission" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content>
            {missionsResponse?.data?.map((mission) => (
              <Select.Item
                key={mission.id}
                item={{ value: mission.id, label: mission.name }}
              >
                {mission.name}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default MissionDropdown
