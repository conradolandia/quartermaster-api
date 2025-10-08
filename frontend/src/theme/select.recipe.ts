import { defineSlotRecipe } from "@chakra-ui/react"

export const selectRecipe = defineSlotRecipe({
  slots: ["root", "trigger", "content", "item", "valueText"],
  base: {
    trigger: {
      bg: "dark.bg.secondary",
      border: "1px solid",
      borderColor: "dark.border.accent",
      borderRadius: "md",
      color: "text.primary",
      px: 3,
      py: 2,
      fontSize: "sm",
      transition: "all 0.2s",
      cursor: "pointer",
      position: "relative",
      _hover: {
        borderColor: "accent.default",
        bg: "dark.bg.hover",
      },
      _focus: {
        borderColor: "accent.default",
        boxShadow: "0 0 0 1px var(--chakra-colors-accent-default)",
        outline: "none",
      },
    },
    content: {
      bg: "dark.bg.secondary",
      border: "1px solid",
      borderColor: "dark.border.accent",
      borderRadius: "md",
      boxShadow: "lg",
      zIndex: 1000,
      position: "absolute",
    },
    item: {
      px: 3,
      py: 2,
      fontSize: "sm",
      color: "text.primary",
      cursor: "pointer",
      transition: "all 0.2s",
      _hover: {
        bg: "dark.bg.hover",
      },
      _selected: {
        bg: "dark.accent.primary",
        color: "dark.bg.primary",
        fontWeight: "medium",
      },
    },
    valueText: {
      color: "text.primary",
    },
  },
  variants: {
    size: {
      xs: {
        trigger: {
          px: 2,
          py: 1,
          fontSize: "xs",
        },
        item: {
          px: 2,
          py: 1,
          fontSize: "xs",
        },
      },
      sm: {
        trigger: {
          px: 3,
          py: 2,
          fontSize: "sm",
        },
        item: {
          px: 3,
          py: 2,
          fontSize: "sm",
        },
      },
      md: {
        trigger: {
          px: 3,
          py: 2,
          fontSize: "md",
        },
        item: {
          px: 3,
          py: 2,
          fontSize: "md",
        },
      },
      lg: {
        trigger: {
          px: 4,
          py: 3,
          fontSize: "lg",
        },
        item: {
          px: 4,
          py: 3,
          fontSize: "lg",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})
