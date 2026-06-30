# XIV Flips

Mobile-first Final Fantasy XIV market flip tracker for recording purchases, listings, sales, and profit outcomes. The app uses XIVAuth for authentication, PostgreSQL for durable storage, and daily market snapshots sourced from the existing xivarbitrage API.

The project is implemented as a portable pnpm workspace with a static frontend, Hono API, PostgreSQL database, and daily market snapshot worker.

## Planned Stack

- Frontend: Vite, React, TypeScript, Mantine
- API: Hono, TypeScript
- Auth: XIVAuth OAuth login with signed app sessions
- Database: PostgreSQL with Drizzle ORM and SQL migrations
- Shared package: Zod schemas, TypeScript types, and profit calculations
- Background market job: daily worker/CLI that pulls xivarbitrage API data

## Planned Hostname

- `https://xivflips.projects.blueskye.co.uk`

## Workspace

```text
apps/api          Hono API, XIVAuth OAuth/session handling, Drizzle/PostgreSQL, worker entrypoint
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

## XIVAuth

Create a confidential XIVAuth OAuth client using the authorization code flow, then set:

- `APP_SESSION_SECRET`
- `XIVAUTH_BASE_URL`
- `XIVAUTH_CLIENT_ID`
- `XIVAUTH_CLIENT_SECRET`
- `XIVAUTH_REDIRECT_URI`

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
