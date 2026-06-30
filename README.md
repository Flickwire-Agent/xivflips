# XIV Flips

Mobile-first Final Fantasy XIV market flip tracker for recording purchases, listings, sales, and profit outcomes. The app uses Auth0 for authentication, PostgreSQL for durable storage, and daily market snapshots sourced from the existing xivarbitrage API.

The project is implemented as a portable pnpm workspace with a static frontend, Hono API, PostgreSQL database, and daily market snapshot worker.

## Planned Stack

- Frontend: Vite, React, TypeScript, Mantine
- API: Hono, TypeScript
- Auth: Auth0 SPA login with API JWT validation
- Database: PostgreSQL with Drizzle ORM and SQL migrations
- Shared package: Zod schemas, TypeScript types, and profit calculations
- Background market job: daily worker/CLI that pulls xivarbitrage API data

## Planned Hostname

- `https://xivflips.projects.blueskye.co.uk`

## Workspace

```text
apps/api          Hono API, Auth0 JWT validation, Drizzle/PostgreSQL, worker entrypoint
apps/web          Vite React SPA optimized for mobile usage first
packages/shared   Shared schemas, DTOs, formatting helpers, and profit math
drizzle            SQL migrations
```

## Getting Started

```bash
pnpm install
cp .env.example .env
pnpm --filter @xivflips/api db:migrate
pnpm dev
```

Local defaults:

- Web: `http://localhost:5173`
- API: `http://localhost:4010/api`

## Auth0

Create an Auth0 Single Page Application and API, then set:

- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_AUDIENCE`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`

Only `/` is public. All app routes and API functionality require login, except `GET /api/health`.

## Market Snapshots

Run the daily snapshot worker manually with:

```bash
pnpm --filter @xivflips/api market:snapshot
```

Schedule that command once daily with cron, systemd timer, or pm2. The worker pulls tracked and watchlisted item data from `XIVARBITRAGE_API_BASE_URL`, stores a daily snapshot, prunes old snapshots, and exits.

## Verification

```bash
pnpm lint
pnpm format
pnpm test:run
pnpm build
```

## Planning Documents

- `IMPLEMENTATION_PLAN.md`: architecture, scope, data model, APIs, deployment, and risk notes
- `TASKS.md`: concrete implementation task list with acceptance checks
