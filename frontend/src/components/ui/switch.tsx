import { Switch as SwitchNamespace } from "@chakra-ui/react"
import * as React from "react"

export interface SwitchProps {
  id?: string
  isChecked?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  isDisabled?: boolean
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  function Switch(props, ref) {
    const { id, isChecked, onChange, isDisabled } = props

    // Create a handler that properly maps the Chakra UI v3 onChange to our expected type
    const handleChange = (details: { checked: boolean }) => {
      if (onChange) {
        // Create a synthetic event to match the expected interface
        const event = {
          target: { checked: details.checked },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }
    }

    return (
      <SwitchNamespace.Root
        checked={isChecked}
        onCheckedChange={handleChange}
        disabled={isDisabled}
      >
        <SwitchNamespace.HiddenInput ref={ref} id={id} />
        <SwitchNamespace.Control>
          <SwitchNamespace.Thumb />
        </SwitchNamespace.Control>
      </SwitchNamespace.Root>
    )
  },
)
