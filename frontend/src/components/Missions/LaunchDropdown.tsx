import { useQuery } from "@tanstack/react-query"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { LaunchesService } from "@/client"
import { RefObject } from "react"

interface LaunchDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const LaunchDropdown = ({
  value,
  onChange,
  id,
  isDisabled,
  portalRef,
  ...props
}: LaunchDropdownProps) => {
  // Use React Query to fetch launches
  const {
    data: launchesResponse,
    isLoading,
  } = useQuery({
    queryKey: ["launches-dropdown"],
    queryFn: () => {
      try {
        return LaunchesService.readLaunches()
      } catch (error) {
        console.error("Error fetching launches:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1
  })

  // Create a collection from the API response
  const launchesCollection = createListCollection({
    items: launchesResponse?.data?.map(launch => ({
      label: launch.name,
      value: launch.id
    })) || []
  })

  return (
    <Select.Root
      collection={launchesCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Select launch" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content>
            {launchesResponse?.data?.map((launch) => (
              <Select.Item
                key={launch.id}
                item={{ value: launch.id, label: launch.name }}
              >
                {launch.name}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default LaunchDropdown
