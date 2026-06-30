import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");

  return {
    envDir: "../..",
    define: {
      "import.meta.env.API_BASE_URL": JSON.stringify(env.API_BASE_URL),
      "import.meta.env.AUTH0_DOMAIN": JSON.stringify(env.AUTH0_DOMAIN),
      "import.meta.env.AUTH0_CLIENT_ID": JSON.stringify(env.AUTH0_CLIENT_ID),
      "import.meta.env.AUTH0_AUDIENCE": JSON.stringify(env.AUTH0_AUDIENCE),
    },
    plugins: [react()],
  };
});
