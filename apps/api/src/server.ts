import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`XIV Flips API listening on http://localhost:${info.port}`);
  },
);
