import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");

  return {
    envDir: "../..",
    define: {
      "import.meta.env.API_BASE_URL": JSON.stringify(env.API_BASE_URL),
    },
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-router")
            )
              return "react";
            if (id.includes("/node_modules/@mantine/")) return "mantine";
            if (id.includes("/node_modules/@tanstack/react-query")) return "query";
            if (id.includes("/node_modules/@xivflips/shared")) return "shared";
            if (id.includes("/node_modules/lucide-react")) return "icons";
          },
        },
      },
    },
  };
});
