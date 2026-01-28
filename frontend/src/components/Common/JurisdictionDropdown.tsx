// @ts-ignore
import { JurisdictionsService, LocationsService } from "@/client"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import type { RefObject } from "react"

interface JurisdictionDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  locationId?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const JurisdictionDropdown = ({
  value,
  onChange,
  id,
  locationId,
  isDisabled,
  portalRef,
  ...props
}: JurisdictionDropdownProps) => {
  // Use React Query to fetch jurisdictions
  const { data: jurisdictionsResponse, isLoading } = useQuery({
    queryKey: ["jurisdictions-dropdown", locationId],
    queryFn: () => {
      try {
        return JurisdictionsService.readJurisdictions({
          limit: 100,
          locationId,
        })
      } catch (error) {
        console.error("Error fetching jurisdictions:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  })

  // Fetch locations for state lookup
  const { data: locationsData } = useQuery({
    queryKey: ["locations-dropdown"],
    queryFn: () => LocationsService.readLocations({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  // Create locations map
  const locationsMap = new Map()
  if (locationsData?.data) {
    locationsData.data.forEach((location) => {
      locationsMap.set(location.id, location)
    })
  }

  // Helper to get state from jurisdiction
  const getJurisdictionState = (jurisdiction: any) => {
    return (
      jurisdiction.location?.state ||
      locationsMap.get(jurisdiction.location_id)?.state ||
      ""
    )
  }

  // Create a collection from the API response
  const jurisdictionsCollection = createListCollection({
    items:
      jurisdictionsResponse?.data?.map((jurisdiction) => {
        const state = getJurisdictionState(jurisdiction)
        return {
          label: state ? `${jurisdiction.name} (${state})` : jurisdiction.name,
          value: jurisdiction.id,
        }
      }) || [],
  })

  return (
    <Select.Root
      collection={jurisdictionsCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control width="100%">
        <Select.Trigger>
          <Select.ValueText placeholder="Select jurisdiction" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content minWidth="300px">
            {jurisdictionsResponse?.data?.map((jurisdiction) => {
              const state = getJurisdictionState(jurisdiction)
              const label = state
                ? `${jurisdiction.name} (${state})`
                : jurisdiction.name
              return (
                <Select.Item
                  key={jurisdiction.id}
                  item={{
                    value: jurisdiction.id,
                    label,
                  }}
                >
                  {label}
                  <Select.ItemIndicator />
                </Select.Item>
              )
            })}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default JurisdictionDropdown
