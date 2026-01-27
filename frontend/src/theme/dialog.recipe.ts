import { defineSlotRecipe } from "@chakra-ui/react"

export const dialogRecipe = defineSlotRecipe({
  slots: [
    "backdrop",
    "positioner",
    "content",
    "header",
    "body",
    "footer",
    "title",
    "description",
  ],
  base: {
    backdrop: {
      bg: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
    },
    positioner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "fixed",
      inset: 0,
      zIndex: 2000,
      p: 4,
    },
    content: {
      bg: "dark.bg.primary",
      color: "text.primary",
      borderRadius: "lg",
      border: "1px solid",
      borderColor: "dark.border.default",
      boxShadow: "2xl",
      maxW: "md",
      w: "full",
      maxH: "90vh",
      overflow: "auto",
      position: "relative",
    },
    header: {
      p: 6,
      pb: 4,
      borderBottom: "1px solid",
      borderColor: "dark.border.default",
    },
    body: {
      p: 6,
      py: 4,
    },
    footer: {
      p: 6,
      pt: 4,
      borderTop: "1px solid",
      borderColor: "dark.border.default",
      display: "flex",
      gap: 3,
      justifyContent: "flex-end",
    },
    title: {
      fontSize: "lg",
      fontWeight: "semibold",
      color: "text.primary",
    },
    description: {
      color: "text.secondary",
      fontSize: "sm",
      mt: 1,
    },
  },
  variants: {
    size: {
      xs: {
        content: { maxW: "xs" },
      },
      sm: {
        content: { maxW: "sm" },
      },
      md: {
        content: { maxW: "md" },
      },
      lg: {
        content: { maxW: "lg" },
      },
      xl: {
        content: { maxW: "xl" },
      },
      "2xl": {
        content: { maxW: "2xl" },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})
