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
  };
});
