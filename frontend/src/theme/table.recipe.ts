import { defineSlotRecipe } from "@chakra-ui/react"

export const tableRecipe = defineSlotRecipe({
  slots: ["root", "header", "body", "row", "columnHeader", "cell"],
  base: {
    root: {
      borderCollapse: "collapse",
      width: "100%",
      borderRadius: "md",
      overflow: "hidden",
      border: "1px solid",
      borderColor: "border.default",
    },
    header: {
      bg: "dark.bg.accent",
    },
    body: {
      bg: "bg.light",
    },
    row: {
      _hover: {
        bg: "dark.bg.hover",
      },
    },
    columnHeader: {
      bg: "dark.bg.accent",
      color: "text.primary",
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: "wider",
      py: 4,
      px: 4,
      borderBottom: "1px solid",
      borderColor: "border.default",
    },
    cell: {
      color: "text.secondary",
      bg: "bg.surface",
      py: 4,
      px: 4,
      borderBottom: "1px solid",
      borderColor: "border.subtle",
    },
  },
  variants: {
    size: {
      xs: {
        columnHeader: {
          py: 1,
          px: 2,
          fontSize: "xs",
        },
        cell: {
          py: 1,
          px: 2,
          fontSize: "xs",
        },
      },
      sm: {
        columnHeader: {
          py: 2,
          px: 3,
          fontSize: "xs",
        },
        cell: {
          py: 2,
          px: 3,
          fontSize: "xs",
        },
      },
      md: {
        columnHeader: {
          py: 4,
          px: 4,
          fontSize: "sm",
        },
        cell: {
          py: 4,
          px: 4,
          fontSize: "sm",
        },
      },
      lg: {
        columnHeader: {
          py: 5,
          px: 5,
          fontSize: "md",
        },
        cell: {
          py: 5,
          px: 5,
          fontSize: "md",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})
