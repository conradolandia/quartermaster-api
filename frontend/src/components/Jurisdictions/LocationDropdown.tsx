import { useQuery } from "@tanstack/react-query"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { LocationsService } from "@/client"
import React, { RefObject } from "react"

interface LocationDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const LocationDropdown = ({
  value,
  onChange,
  id,
  isDisabled,
  portalRef,
  ...props
}: LocationDropdownProps) => {
  // Use React Query to fetch locations
  const {
    data: locationsResponse,
    isLoading,
  } = useQuery({
    queryKey: ["locations-dropdown"],
    queryFn: () => {
      try {
        return LocationsService.readLocations()
      } catch (error) {
        console.error("Error fetching locations:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1
  })

  // Create a collection from the API response
  const locationsCollection = createListCollection({
    items: locationsResponse?.data?.map(location => ({
      label: `${location.name} (${location.state})`,
      value: location.id
    })) || []
  })

  return (
    <Select.Root
      collection={locationsCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Select location" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content>
            {locationsResponse?.data?.map((location) => (
              <Select.Item
                key={location.id}
                item={{ value: location.id, label: `${location.name} (${location.state})` }}
              >
                {location.name} ({location.state})
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default LocationDropdown;
