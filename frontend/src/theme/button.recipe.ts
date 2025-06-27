import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
  base: {
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "md",
    transition: "all 0.2s",
    cursor: "pointer",
  },
  variants: {
    variant: {
      // Primary accent button
      solid: {
        bg: "dark.accent.primary",
        color: "dark.bg.primary",
        _hover: {
          bg: "dark.accent.hover",
        },
        _active: {
          bg: "dark.accent.active",
        },
      },
      // Ghost variant
      ghost: {
        bg: "transparent",
        color: "dark.accent.primary",
        _hover: {
          bg: "dark.bg.accent",
          color: "dark.accent.light",
        },
        _active: {
          bg: "dark.bg.hover",
        },
      },
      // Outline variant
      outline: {
        bg: "transparent",
        border: "1px solid",
        borderColor: "dark.accent.primary",
        color: "dark.accent.primary",
        _hover: {
          bg: "dark.accent.primary",
          color: "dark.bg.primary",
        },
        _active: {
          bg: "dark.accent.active",
          borderColor: "dark.accent.active",
        },
      },
      // Secondary variant - uses background colors
      secondary: {
        bg: "dark.bg.secondary",
        color: "dark.text.primary",
        border: "1px solid",
        borderColor: "dark.border.accent",
        _hover: {
          bg: "dark.bg.hover",
          borderColor: "dark.accent.primary",
        },
        _active: {
          bg: "dark.bg.active",
        },
      },
      // Success variant
      success: {
        bg: "dark.status.success",
        color: "white",
        _hover: {
          bg: "green.600",
        },
        _active: {
          bg: "green.700",
        },
      },
      // Danger variant
      danger: {
        bg: "dark.status.error",
        color: "white",
        _hover: {
          bg: "red.600",
        },
        _active: {
          bg: "red.700",
        },
      },
      // Warning variant
      warning: {
        bg: "dark.status.warning",
        color: "dark.bg.primary",
        _hover: {
          bg: "orange.600",
        },
        _active: {
          bg: "orange.700",
        },
      },
      // Info variant
      info: {
        bg: "dark.status.info",
        color: "white",
        _hover: {
          bg: "blue.600",
        },
        _active: {
          bg: "blue.700",
        },
      },
    },
    size: {
      xs: {
        px: 2,
        py: 1,
        fontSize: "xs",
        minH: "6",
      },
      sm: {
        px: 3,
        py: 2,
        fontSize: "sm",
        minH: "8",
      },
      md: {
        px: 4,
        py: 2,
        fontSize: "md",
        minH: "10",
      },
      lg: {
        px: 6,
        py: 3,
        fontSize: "lg",
        minH: "12",
      },
      xl: {
        px: 8,
        py: 4,
        fontSize: "xl",
        minH: "14",
      },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
})
