import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { config, isProduction } from "./config.js";
import { HttpError } from "./http/errors.js";
import { requireAuth, type AppEnv } from "./http/auth.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerProtectedRoutes } from "./routes/protected.js";
import { registerXivauthRoutes } from "./routes/xivauth.js";

export function createApp() {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use(
    "*",
    cors({
      origin: isProduction() ? [config.appBaseUrl] : [config.appBaseUrl, "http://localhost:5173"],
      allowHeaders: ["authorization", "content-type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use("*", logger());

  registerHealthRoute(app);
  registerXivauthRoutes(app);

  app.use("*", requireAuth);
  registerProtectedRoutes(app);

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404 | 503);
    }

    if (error instanceof ZodError) {
      return c.json({ error: "Validation failed", issues: error.issues }, 400);
    }

    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
