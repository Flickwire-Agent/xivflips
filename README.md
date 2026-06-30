# XIV Flips

Mobile-first Final Fantasy XIV market flip tracker for recording purchases, listings, sales, and profit outcomes. The app uses Auth0 for authentication, PostgreSQL for durable storage, and daily market snapshots sourced from the existing xivarbitrage API.

This directory currently contains planning scaffolding only. Application implementation should not begin until the implementation plan is signed off.

## Planned Stack

- Frontend: Vite, React, TypeScript, Mantine
- API: Hono, TypeScript
- Auth: Auth0 SPA login with API JWT validation
- Database: PostgreSQL with Drizzle ORM and SQL migrations
- Shared package: Zod schemas, TypeScript types, and profit calculations
- Background market job: daily worker/CLI that pulls xivarbitrage API data

## Planned Hostname

- `https://xivflips.projects.blueskye.co.uk`

## Planning Documents

- `IMPLEMENTATION_PLAN.md`: architecture, scope, data model, APIs, deployment, and risk notes
- `TASKS.md`: concrete implementation task list with acceptance checks
