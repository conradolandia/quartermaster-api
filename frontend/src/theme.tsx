import { createSystem, defaultConfig } from "@chakra-ui/react"
import { buttonRecipe } from "./theme/button.recipe"
import { dialogRecipe } from "./theme/dialog.recipe"
import { inputRecipe } from "./theme/input.recipe"
import { selectRecipe } from "./theme/select.recipe"
import { tableRecipe } from "./theme/table.recipe"
import { textareaRecipe } from "./theme/textarea.recipe"

export const system = createSystem(defaultConfig, {
  globalCss: {
    html: {
      fontSize: "16px",
      fontFamily:
        "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    },
    body: {
      fontSize: "0.875rem",
      margin: 0,
      padding: 0,
      bg: "dark.bg.primary",
      color: "dark.text.primary",
      fontFamily:
        "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    },
    ".main-link": {
      color: "dark.accent.primary",
      fontWeight: "bold",
    },
    "::selection": {
      backgroundColor: "dark.accent.primary",
      color: "dark.bg.primary",
    },
    "::-moz-selection": {
      backgroundColor: "dark.accent.primary",
      color: "dark.bg.primary",
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: {
          value:
            "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        },
        body: {
          value:
            "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        },
        mono: {
          value: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        },
      },
      fontSizes: {
        "2xs": { value: "0.6rem" },
        xs: { value: "0.7rem" },
        sm: { value: "0.875rem" },
        md: { value: "1rem" },
        lg: { value: "1.125rem" },
        xl: { value: "1.25rem" },
      },
      colors: {
        // Dark theme colors based on your specifications
        dark: {
          // Foreground/Text colors
          text: {
            primary: { value: "#ffffff" }, // brand_fg_color
            secondary: { value: "#eeeeee" }, // brand_fg_alt_color
            muted: { value: "#a0a0a0" }, // Derived muted text
            disabled: { value: "#666666" }, // Derived disabled text
            highlight: { value: "#fda801" }, // code text
          },
          // Background colors
          bg: {
            primary: { value: "#19232d" }, // brand_bg_color
            secondary: { value: "#28343B" }, // brand_bg_alt_color
            accent: { value: "#0C1116" }, // brand_bg_accent_color
            hover: { value: "#3a4a57" }, // Derived hover state
            active: { value: "#4a5a67" }, // Derived active state
            light: { value: "#424f5c" }, // Lighter background for tables
          },
          // Accent colors
          accent: {
            primary: { value: "#fda801" }, // brand_accent_color
            hover: { value: "#e69500" }, // Darker for hover
            active: { value: "#cc8400" }, // Darker for active
            light: { value: "#fdb835" }, // Lighter variant
            dark: { value: "#d48f00" }, // Darker variant
          },
          // Border colors
          border: {
            default: { value: "#4a5a67" }, // Lighter borders for better visibility
            accent: { value: "#5a6a77" }, // More prominent borders
            focus: { value: "#fda801" }, // Focus states
          },
          // Status colors for dark theme
          status: {
            success: { value: "#4caf50" },
            warning: { value: "#ff9800" },
            error: { value: "#f44336" },
            info: { value: "#2196f3" },
          },
        },
        // Keep original brand colors as fallback/alternative
        brand: {
          50: { value: "#fff3e0" },
          100: { value: "#ffe0b3" },
          200: { value: "#ffcc80" },
          300: { value: "#ffb74d" },
          400: { value: "#ffa726" },
          500: { value: "#fda801" }, // Main accent
          600: { value: "#e69500" },
          700: { value: "#cc8400" },
          800: { value: "#b37300" },
          900: { value: "#996200" },
        },
        // Custom UI colors
        ui: {
          main: { value: "#fda801" },
          secondary: { value: "#32414b" },
          accent: { value: "#333333" },
          light: { value: "#eeeeee" },
          dark: { value: "#19232d" },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          canvas: { value: "{colors.dark.bg.primary}" },
          surface: { value: "{colors.dark.bg.secondary}" },
          panel: { value: "{colors.dark.bg.secondary}" },
          light: { value: "{colors.dark.bg.light}" },
          accent: { value: "{colors.dark.bg.accent}" },
          "accent.hover": { value: "{colors.dark.bg.hover}" },
          "accent.active": { value: "{colors.dark.bg.active}" },
        },
        text: {
          primary: { value: "{colors.dark.text.primary}" },
          secondary: { value: "{colors.dark.text.secondary}" },
          muted: { value: "{colors.dark.text.muted}" },
          disabled: { value: "{colors.dark.text.disabled}" },
        },
        border: {
          DEFAULT: { value: "{colors.dark.border.accent}" },
          default: { value: "{colors.dark.border.default}" },
          accent: { value: "{colors.dark.border.accent}" },
          focus: { value: "{colors.dark.border.focus}" },
        },
        accent: {
          default: { value: "{colors.dark.accent.primary}" },
          hover: { value: "{colors.dark.accent.hover}" },
          active: { value: "{colors.dark.accent.active}" },
          light: { value: "{colors.dark.accent.light}" },
        },
        status: {
          success: { value: "{colors.dark.status.success}" },
          warning: { value: "{colors.dark.status.warning}" },
          error: { value: "{colors.dark.status.error}" },
          info: { value: "{colors.dark.status.info}" },
        },
      },
    },
    recipes: {
      button: buttonRecipe,
      input: inputRecipe,
      textarea: textareaRecipe,
    },
    slotRecipes: {
      table: tableRecipe,
      dialog: dialogRecipe,
      select: selectRecipe,
    },
  },
})
