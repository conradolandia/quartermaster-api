import { useQuery } from "@tanstack/react-query"
import { Portal, Select, createListCollection } from "@chakra-ui/react"
import { UtilsService } from "@/client"
import { RefObject } from "react"

interface StateDropdownProps {
  value: string
  onChange: (value: string) => void
  id?: string
  isDisabled?: boolean
  portalRef?: RefObject<HTMLElement>
  [key: string]: any // For other props
}

export const StateDropdown = ({
  value,
  onChange,
  id,
  isDisabled,
  portalRef,
  ...props
}: StateDropdownProps) => {
  // Use React Query to fetch states
  const {
    data: statesResponse,
    isLoading,
  } = useQuery({
    queryKey: ["us-states"],
    queryFn: () => {
      try {
        return UtilsService.getUsStates()
      } catch (error) {
        console.error("Error fetching states:", error)
        throw error
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 1
  })

  // Create a collection from the API response
  const statesCollection = createListCollection({
    items: statesResponse?.data?.map(state => ({
      label: `${state.name} (${state.code})`,
      value: state.code
    })) || []
  })

  return (
    <Select.Root
      collection={statesCollection}
      size="md"
      value={value ? [value] : []}
      onValueChange={(e) => onChange(e.value[0] || "")}
      disabled={isDisabled || isLoading}
      {...props}
    >
      <Select.HiddenSelect id={id} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Select state" />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalRef}>
        <Select.Positioner>
          <Select.Content>
            {statesResponse?.data?.map((state) => (
              <Select.Item
                key={state.code}
                item={{ value: state.code, label: `${state.name} (${state.code})` }}
              >
                {state.name} ({state.code})
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}

export default StateDropdown;
