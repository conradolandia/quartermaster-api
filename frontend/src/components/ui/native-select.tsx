import * as React from "react"

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /**
   * Size variant for the select
   * @default "md"
   */
  size?: "sm" | "md" | "lg"
}

/**
 * A styled native HTML select element that matches the Chakra UI theme.
 * Use this instead of inline styles for consistent select styling across the app.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  NativeSelectProps
>(function NativeSelect(props, ref) {
  const { size = "md", style, ...rest } = props

  const sizeStyles = {
    sm: {
      padding: "0.375rem",
      fontSize: "0.875rem",
    },
    md: {
      padding: "0.5rem",
      fontSize: "1rem",
    },
    lg: {
      padding: "0.625rem",
      fontSize: "1.125rem",
    },
  }

  const baseStyles: React.CSSProperties = {
    width: "100%",
    padding: sizeStyles[size].padding,
    borderRadius: "0.375rem",
    border: "1px solid",
    borderColor: "inherit",
    backgroundColor: "var(--chakra-colors-dark-bg-primary)",
    color: "var(--chakra-colors-text-primary)",
    fontSize: sizeStyles[size].fontSize,
    transition: "all 0.2s",
    cursor: "pointer",
  }

  return (
    <select
      ref={ref}
      {...rest}
      style={{
        ...baseStyles,
        ...style,
      }}
    />
  )
})
