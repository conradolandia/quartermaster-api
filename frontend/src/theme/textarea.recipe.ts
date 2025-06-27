import { defineRecipe } from "@chakra-ui/react"

export const textareaRecipe = defineRecipe({
  base: {
    bg: "dark.bg.secondary",
    border: "1px solid",
    borderColor: "dark.border.default",
    borderRadius: "md",
    color: "text.primary",
    px: 3,
    py: 2,
    fontSize: "sm",
    transition: "all 0.2s",
    resize: "vertical",
    minH: "20",
    _placeholder: {
      color: "text.muted",
    },
    _hover: {
      borderColor: "dark.border.accent",
    },
    _focus: {
      borderColor: "accent.default",
      boxShadow: "0 0 0 1px var(--chakra-colors-accent-default)",
      outline: "none",
    },
    _invalid: {
      borderColor: "status.error",
      boxShadow: "0 0 0 1px var(--chakra-colors-status-error)",
    },
    _disabled: {
      bg: "dark.bg.accent",
      color: "text.disabled",
      borderColor: "dark.border.default",
      cursor: "not-allowed",
      resize: "none",
    },
    _readOnly: {
      bg: "dark.bg.accent",
      color: "text.muted",
      borderColor: "dark.border.default",
      cursor: "default",
      resize: "none",
    },
  },
  variants: {
    size: {
      sm: {
        px: 3,
        py: 2,
        fontSize: "sm",
      },
      md: {
        px: 3,
        py: 2,
        fontSize: "md",
      },
      lg: {
        px: 4,
        py: 3,
        fontSize: "lg",
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})
