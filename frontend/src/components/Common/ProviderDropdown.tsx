import { ProvidersService } from "@/client"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import type { RefObject } from "react"

interface ProviderDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  jurisdictionId?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const ProviderDropdown = ({
  value,
  onChange,
  id,
  jurisdictionId,
  isDisabled,
  portalRef,
  ...props
}: ProviderDropdownProps) => {
  // Use React Query to fetch providers
  const { data: providersResponse, isLoading } = useQuery({
    queryKey: ["providers-dropdown", jurisdictionId],
    queryFn: () => {
      try {
        return ProvidersService.readProviders({
          limit: 100,
          jurisdictionId,
        })
      } catch (error) {
        console.error("Error fetching providers:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  })

  // Create a collection from the API response
  const providersCollection = createListCollection({
    items:
      providersResponse?.data?.map((provider) => ({
        label: provider.name,
        value: provider.id,
      })) || [],
  })

  return (
    <Select.Root
      collection={providersCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control width="100%">
        <Select.Trigger>
          <Select.ValueText placeholder="Select provider" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content minWidth="300px">
            {providersResponse?.data?.map((provider) => (
              <Select.Item
                key={provider.id}
                item={{
                  value: provider.id,
                  label: provider.name,
                }}
              >
                {provider.name}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default ProviderDropdown
