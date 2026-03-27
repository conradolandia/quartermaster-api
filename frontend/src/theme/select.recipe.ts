import { defineSlotRecipe } from "@chakra-ui/react"
import { selectAnatomy } from "@chakra-ui/react/anatomy"

/**
 * Must list every slot from {@link selectAnatomy}; a partial list replaces the
 * default recipe and drops indicator/indicatorGroup styles (no chevron).
 */
export const selectRecipe = defineSlotRecipe({
  slots: selectAnatomy.keys(),
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "1.5",
      width: "full",
    },
    control: {
      pos: "relative",
      width: "full",
    },
    indicatorGroup: {
      display: "flex",
      alignItems: "center",
      gap: "1",
      pos: "absolute",
      insetEnd: "0",
      top: "0",
      bottom: "0",
      px: "3",
      pointerEvents: "none",
    },
    indicator: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "text.muted",
      _icon: {
        width: "4",
        height: "4",
      },
    },
    trigger: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "full",
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
      display: "flex",
      flexDirection: "column",
      maxH: "96",
      overflowY: "auto",
      w: "full",
      maxW: "min(80vw, 28rem)",
    },
    list: {
      display: "flex",
      flexDirection: "column",
      w: "full",
    },
    item: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: "2",
      justifyContent: "space-between",
      w: "full",
      maxW: "min(80vw, 28rem)",
      flexShrink: 0,
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
    itemText: {
      flex: "1",
      textAlign: "start",
    },
    itemIndicator: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    valueText: {
      color: "text.primary",
      maxW: "calc(100% - 2.75rem)",
      minW: 0,
      lineClamp: "1",
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
        indicator: {
          _icon: {
            width: "3.5",
            height: "3.5",
          },
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
        indicator: {
          _icon: {
            width: "4",
            height: "4",
          },
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
        indicator: {
          _icon: {
            width: "4",
            height: "4",
          },
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
        indicator: {
          _icon: {
            width: "5",
            height: "5",
          },
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})
