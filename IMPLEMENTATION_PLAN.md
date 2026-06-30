# XIV Flips Implementation Plan

## Goal

Build a portable, mobile-first web app for tracking Final Fantasy XIV market flips. Users should be able to log purchases, track active inventory/listings, record sales, review realized profit, and use daily market snapshots from the existing xivarbitrage API to contextualize opportunities.

## Explicit Requirements

- Do not use Next.js.
- Require login for all functionality except a simple public landing page.
- Optimize primarily for mobile usage.
- Use PostgreSQL for persistence.
- Use Auth0 for authentication.
- Use a background task to pull market snapshot data from the xivarbitrage API once daily.
- Wait for human sign-off before implementation beyond planning scaffolding.

## Recommended Architecture

Use a pnpm workspace with a static SPA, a portable Hono API, and a shared package.

```text
xivflips.projects.blueskye.co.uk/
├── apps/
│   ├── api/               # Hono API, Auth0 JWT validation, Drizzle/Postgres, worker entrypoints
│   └── web/               # Vite React SPA, mobile-first UI
├── packages/
│   └── shared/            # Shared zod schemas, types, constants, and profit math
├── drizzle/               # SQL migration files
├── IMPLEMENTATION_PLAN.md
├── TASKS.md
└── README.md
```

## Stack Choices

### Frontend

- Vite for a plain static build that can be served by Caddy, nginx, Hono, object storage, or static hosts.
- React 19 for the UI.
- Mantine v9 for accessible mobile-friendly primitives, forms, modals, notifications, and charts.
- Auth0 React SDK for login, logout, token acquisition, and session-aware rendering.
- TanStack Query for API state, caching, retries, loading states, and mutation invalidation.
- Wouter or React Router for SPA routing. Prefer React Router if nested layouts become useful; otherwise Wouter is smaller.

### API

- Hono for portable HTTP routing.
- Node adapter initially for local pm2 deployment.
- Keep runtime-specific code at entrypoints only, so core routes/services remain portable.
- `jose` for Auth0 JWT validation against the Auth0 JWKS endpoint.
- Zod for request/response validation.

### Database

- PostgreSQL as the source of truth.
- Drizzle ORM with SQL migrations for a lightweight, portable database layer.
- `pg` driver for the initial Node runtime.
- Use migrations rather than implicit schema sync.

### Background Work

- Implement a separate market snapshot worker/CLI in `apps/api`.
- The worker runs once and exits, so it can be scheduled by cron, systemd timer, pm2, GitHub Actions, or another scheduler.
- Production default: schedule once daily on the server.
- Avoid tying market refresh to web request handling.

## Auth Model

The only unauthenticated page is `/`, a simple landing page with product explanation and login CTA.

All app routes require login:

- `/dashboard`
- `/flips`
- `/flips/new`
- `/flips/:id`
- `/watchlist`
- `/settings`

Frontend enforcement:

- Public landing page checks session and can redirect authenticated users to `/dashboard`.
- Protected route shell requires an Auth0 session.
- If unauthenticated, show a compact mobile-friendly login prompt rather than the app shell.

API enforcement:

- All `/api/*` routes require a valid bearer token except `/api/health` and any future public metadata endpoint explicitly marked public.
- API validates Auth0 JWT issuer, audience, algorithm, expiry, and signature.
- On first valid request, sync the Auth0 subject into a local `users` row.

Required Auth0 configuration:

- Application type: Single Page Application.
- API audience: e.g. `https://xivflips.projects.blueskye.co.uk/api`.
- Allowed callback URLs: local dev and production host.
- Allowed logout URLs: local dev and production host.
- Allowed web origins: local dev and production host.

## Mobile-First Product Design

Primary target: phone usage while checking the market board or reviewing retainers.

Design principles:

- Bottom navigation for primary sections on small screens.
- Large tap targets, compact dense cards, minimal horizontal tables.
- Prefer card lists over wide desktop tables for flip records.
- Desktop can enhance with split panes and sortable tables, but mobile is the baseline.
- Forms should be fast for repeated data entry: item search, world selector, quantity, unit price, tax/fee, notes.
- Use sticky save actions on mobile forms.
- Avoid multi-column critical flows on small screens.

Core mobile views:

- Dashboard: profit summary cards, active inventory, recent sales, watchlist highlights.
- Flip list: segmented filters for Active, Listed, Sold, Cancelled, All.
- Flip detail: timeline-style purchase/listing/sale events plus market context.
- New flip: single-column form optimized for fast entry.
- Watchlist: target cards with latest daily market snapshot.

## MVP Feature Scope

### Included

- Login/logout through Auth0.
- Local user sync from Auth0 subject.
- Create, edit, archive, and delete tracked flips.
- Record purchases for an item/world/data center.
- Record listing attempts.
- Record sales and market tax/fee.
- Track statuses: active, listed, partially sold, sold, cancelled, archived.
- Dashboard totals: active cost basis, realized profit, realized ROI, unsold inventory value, recent sales.
- Watchlist items with target buy price, target sell price, preferred world/data center, and notes.
- Daily market snapshots pulled from xivarbitrage API for tracked and watchlisted items.
- Item metadata cache for names, icons, and categories.
- World/data center metadata cache.
- Mobile-first responsive UI.

### Deferred

- Real-time alerts.
- Multi-user sharing.
- OCR/import from screenshots.
- Retainer inventory integration.
- Automated cross-data-center scanning independent of xivarbitrage.
- Push notifications.
- Advanced tax rules per city-state or retainer.
- Public leaderboards.

## Data Model

Use snake_case table names in SQL and camelCase in TypeScript.

### users

- `id` UUID primary key.
- `auth0_subject` unique, required.
- `email` nullable.
- `display_name` nullable.
- `home_world_id` nullable.
- `default_tax_rate_bps` integer default `500` for 5%.
- `created_at`, `updated_at`.

### items

- `id` integer primary key, matching FFXIV item ID.
- `name` text required.
- `icon_url` text nullable.
- `category_name` text nullable.
- `is_marketable` boolean default true.
- `metadata` jsonb nullable.
- `updated_at`.

### worlds

- `id` integer primary key.
- `name` text required.
- `data_center` text required.
- `region` text required.
- `updated_at`.

### flips

- `id` UUID primary key.
- `user_id` FK to users.
- `item_id` FK to items.
- `world_id` FK to worlds nullable if unknown.
- `status` enum: active, listed, partially_sold, sold, cancelled, archived.
- `strategy` enum nullable: undercut, velocity, dc_arbitrage, patch_speculation, crafted, other.
- `target_sell_price` integer nullable.
- `notes` text nullable.
- `opened_at`, `closed_at` nullable.
- `created_at`, `updated_at`.

### purchases

- `id` UUID primary key.
- `flip_id` FK to flips.
- `quantity` integer required.
- `unit_price` integer required.
- `world_id` FK to worlds nullable.
- `purchased_at` timestamp required.
- `notes` text nullable.
- `created_at`, `updated_at`.

### listings

- `id` UUID primary key.
- `flip_id` FK to flips.
- `quantity` integer required.
- `unit_price` integer required.
- `world_id` FK to worlds nullable.
- `status` enum: active, sold, cancelled, expired.
- `listed_at`, `ended_at` nullable.
- `notes` text nullable.
- `created_at`, `updated_at`.

### sales

- `id` UUID primary key.
- `flip_id` FK to flips.
- `quantity` integer required.
- `unit_price` integer required.
- `tax_rate_bps` integer required.
- `world_id` FK to worlds nullable.
- `sold_at` timestamp required.
- `notes` text nullable.
- `created_at`, `updated_at`.

### watchlist_items

- `id` UUID primary key.
- `user_id` FK to users.
- `item_id` FK to items.
- `world_id` FK to worlds nullable.
- `data_center` text nullable.
- `target_buy_price` integer nullable.
- `target_sell_price` integer nullable.
- `min_roi_bps` integer nullable.
- `notes` text nullable.
- `created_at`, `updated_at`.

### market_snapshots

- `id` UUID primary key.
- `item_id` FK to items.
- `world_id` FK to worlds nullable.
- `data_center` text nullable.
- `source` text default `xivarbitrage`.
- `lowest_listing_price` integer nullable.
- `recent_avg_price` integer nullable.
- `sale_velocity_7d` integer nullable.
- `sale_count_14d` integer nullable.
- `snapshot_data` jsonb required.
- `captured_at` timestamp required.
- Unique index on `item_id`, `world_id`, `data_center`, `captured_at::date` if feasible, or enforce daily uniqueness in application logic.

## Profit Calculations

Shared package should own pure calculation functions and tests.

Inputs:

- Purchases: quantity and unit price.
- Sales: quantity, unit price, tax rate.
- Optional current market price from latest snapshot.

Derived values:

- Purchased quantity.
- Sold quantity.
- Remaining quantity.
- Total cost basis.
- Average cost per unit.
- Gross sale value.
- Sale tax/fees.
- Net sale value.
- Realized profit.
- Realized ROI.
- Estimated inventory value.
- Estimated unrealized profit.
- Days held.

Use integer gil values and basis points for percentages to avoid floating point drift in persisted data.

## API Design

Base path: `/api`.

Public routes:

- `GET /api/health`: service and database status.

Protected routes:

- `GET /api/me`: current Auth0/local user.
- `PATCH /api/me/settings`: update default world and tax rate.
- `GET /api/worlds`: world and data-center list.
- `GET /api/items/search?q=`: search cached items, then fallback to xivarbitrage/XIVAPI if needed.
- `GET /api/dashboard`: aggregated user dashboard metrics.
- `GET /api/flips`: list user flips with filters.
- `POST /api/flips`: create flip with optional initial purchase.
- `GET /api/flips/:id`: fetch one flip with events and latest market snapshot.
- `PATCH /api/flips/:id`: edit flip metadata/status.
- `DELETE /api/flips/:id`: soft archive or hard delete if no history, to be decided during implementation.
- `POST /api/flips/:id/purchases`: add purchase.
- `PATCH /api/purchases/:id`: edit purchase.
- `DELETE /api/purchases/:id`: delete purchase.
- `POST /api/flips/:id/listings`: add listing.
- `PATCH /api/listings/:id`: edit listing/status.
- `DELETE /api/listings/:id`: delete listing.
- `POST /api/flips/:id/sales`: add sale.
- `PATCH /api/sales/:id`: edit sale.
- `DELETE /api/sales/:id`: delete sale.
- `GET /api/watchlist`: list watchlist items.
- `POST /api/watchlist`: add watchlist item.
- `PATCH /api/watchlist/:id`: edit watchlist item.
- `DELETE /api/watchlist/:id`: delete watchlist item.
- `POST /api/market/refresh`: manually refresh market data for one item or current user's tracked/watchlisted items, guarded by rate limiting.

Authorization rules:

- Every user-owned row must be scoped by `user_id` from the verified token, never by client-provided user ID.
- Return 404 for missing rows and rows owned by another user.
- Admin role is out of MVP unless needed for operations.

## xivarbitrage Snapshot Worker

Worker command shape:

```bash
pnpm --filter @xivflips/api market:snapshot
```

Initial behavior:

- Read distinct item/world/data-center combinations from active flips and watchlist items.
- Refresh world/data-center cache if stale.
- Pull market data from `https://xivarbitrage.projects.blueskye.co.uk/api`.
- Prefer targeted endpoints for tracked items:
  - `GET /api/items/:itemId/listings`
  - `GET /api/items/:itemId/history`
- Optionally pull opportunity pages for watchlist context:
  - `GET /api/bargains`
  - `GET /api/dc-disparities`
- Normalize the response into `market_snapshots`.
- Upsert item metadata into `items`.
- Store raw source response in `snapshot_data` for future recalculation.
- Log summary: items checked, snapshots created, failures, duration.

Scheduling:

- Production should run once daily, preferably off-peak.
- Use cron or systemd timer initially for portability and observability.
- Do not start the worker automatically inside the API server process.

Failure behavior:

- Failed item fetches should not fail the entire job.
- Record failures in logs initially; add a job history table only if needed.
- Keep the last successful snapshot visible in the UI with an age indicator.

## Frontend Route Plan

- `/`: public landing page, login CTA, redirects authenticated users to `/dashboard`.
- `/dashboard`: mobile summary of profit, active flips, watchlist alerts.
- `/flips`: card-based mobile list with filters and search.
- `/flips/new`: create flip and initial purchase.
- `/flips/:id`: detail page with event timeline, profit math, and market context.
- `/watchlist`: target buy/sell thresholds and daily snapshot cards.
- `/settings`: default world, tax rate, account details.

## Validation And Testing

Unit tests:

- Profit calculation edge cases.
- Zod schema parsing.
- Auth middleware behavior with mocked tokens/JWKS.
- Repository functions for user scoping.

Integration tests:

- API route happy paths using a test database or transaction rollback.
- Worker normalization against saved xivarbitrage response fixtures.

Manual verification:

- Mobile viewport pass for all primary flows.
- Login-required route behavior.
- Daily snapshot worker dry run.
- Production build and API health check.

Required commands before deployment:

```bash
pnpm lint
pnpm format
pnpm test:run
pnpm build
```

## Deployment Plan

Initial deployment on this host:

- API runs as a Node process under pm2.
- Web build served either by Hono static middleware or Caddy static hosting.
- API exposed under the same hostname at `/api` to avoid CORS complexity.
- Background snapshot worker scheduled daily via cron or systemd timer.
- PostgreSQL database and user created locally.
- Auth0 application configured for production and local dev URLs.
- Add project to `projects.blueskye.co.uk` registry after it is live.

Expected environment variables:

```bash
DATABASE_URL=postgresql://xivflips:local_dev_password@localhost:5432/xivflips
PORT=4010
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:4010
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_AUDIENCE=https://xivflips.projects.blueskye.co.uk/api
AUTH0_ISSUER_BASE_URL=https://your-tenant.eu.auth0.com/
XIVARBITRAGE_API_BASE_URL=https://xivarbitrage.projects.blueskye.co.uk/api
MARKET_SNAPSHOT_RETENTION_DAYS=90
```

Frontend build-time variables:

```bash
VITE_API_BASE_URL=/api
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=https://xivflips.projects.blueskye.co.uk/api
```

## Risks And Mitigations

- Auth0 SPA/API configuration can be fiddly: validate local login before building deeper features.
- Mobile data entry can become tedious: prioritize fast forms, sticky actions, and sane defaults.
- xivarbitrage API shape may change: isolate API mapping in a single service and store raw snapshots.
- Daily snapshots can be stale for fast-moving markets: show snapshot age clearly and add manual refresh for specific items.
- Profit math can be misleading with partial sales: keep calculations in tested shared functions and show quantity basis.
- Hono portability can be lost if Node-specific APIs leak everywhere: isolate Node-only server and worker entrypoints.

## Sign-Off Gate

Implementation should not begin until this plan and `TASKS.md` are approved.
