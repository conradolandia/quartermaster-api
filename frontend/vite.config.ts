import path from "node:path"
import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [react(), TanStackRouterVite()],
  build: {
    sourcemap: false, // Disable sourcemaps in production to avoid warnings
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks for better caching
          "vendor-react": ["react", "react-dom"],
          "vendor-chakra": ["@chakra-ui/react"],
          "vendor-router": ["@tanstack/react-router", "@tanstack/react-query"],
        },
      },
    },
  },
})
