export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? import.meta.env.API_BASE_URL ?? "/api",
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN ?? import.meta.env.AUTH0_DOMAIN ?? "",
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? import.meta.env.AUTH0_CLIENT_ID ?? "",
  auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? import.meta.env.AUTH0_AUDIENCE ?? "",
};

export const authConfigured = Boolean(env.auth0Domain && env.auth0ClientId && env.auth0Audience);
