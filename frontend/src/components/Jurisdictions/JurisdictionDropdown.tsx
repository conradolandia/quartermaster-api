import { useQuery } from "@tanstack/react-query"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { JurisdictionsService } from "@/client"
import React, { RefObject } from "react"

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
  const {
    data: jurisdictionsResponse,
    isLoading,
  } = useQuery({
    queryKey: ["jurisdictions", locationId],
    queryFn: () => {
      try {
        return JurisdictionsService.readJurisdictions({
          locationId: locationId
        })
      } catch (error) {
        console.error("Error fetching jurisdictions:", error)
        throw error
      }
    },
    enabled: !!locationId, // Only fetch if locationId is provided
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1
  })

  // Create a collection from the API response
  const jurisdictionsCollection = createListCollection({
    items: jurisdictionsResponse?.data?.map(jurisdiction => ({
      label: `${jurisdiction.name} (${jurisdiction.state})`,
      value: jurisdiction.id
    })) || []
  })

  return (
    <Select.Root
      collection={jurisdictionsCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading || !locationId}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={locationId ? "Select jurisdiction" : "Select a location first"} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content>
            {jurisdictionsResponse?.data?.map((jurisdiction) => (
              <Select.Item
                key={jurisdiction.id}
                item={{ value: jurisdiction.id, label: `${jurisdiction.name} (${jurisdiction.state})` }}
              >
                {jurisdiction.name} ({jurisdiction.state})
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default JurisdictionDropdown;
