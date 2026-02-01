import { Checkbox as ChakraCheckbox } from "@chakra-ui/react"
import * as React from "react"

const controlStyleProps = [
  "borderColor",
  "borderWidth",
  "borderStyle",
  "borderRadius",
  "bg",
  "outline",
  "boxShadow",
] as const

export interface CheckboxProps extends ChakraCheckbox.RootProps {
  icon?: React.ReactNode
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  rootRef?: React.Ref<HTMLLabelElement>
  controlProps?: ChakraCheckbox.ControlProps
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(props, ref) {
    const {
      icon,
      children,
      inputProps,
      rootRef,
      controlProps = {},
      ...rest
    } = props
    const [rootProps, controlStyle] = splitControlStyles(rest)
    return (
      <ChakraCheckbox.Root ref={rootRef} {...rootProps}>
        <ChakraCheckbox.HiddenInput ref={ref} {...inputProps} />
        <ChakraCheckbox.Control {...controlStyle} {...controlProps}>
          {icon || <ChakraCheckbox.Indicator />}
        </ChakraCheckbox.Control>
        {children != null && (
          <ChakraCheckbox.Label>{children}</ChakraCheckbox.Label>
        )}
      </ChakraCheckbox.Root>
    )
  },
)

function splitControlStyles(
  props: Record<string, unknown>,
): [Record<string, unknown>, Record<string, unknown>] {
  const root: Record<string, unknown> = {}
  const control: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (controlStyleProps.includes(key as (typeof controlStyleProps)[number])) {
      control[key] = value
    } else {
      root[key] = value
    }
  }
  return [root, control]
}
