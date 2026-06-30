# XIV Flips Task List

Status key: `[ ]` not started, `[~]` in progress, `[x]` complete, `[!]` blocked.

## Phase 0: Sign-Off

- [ ] Review `IMPLEMENTATION_PLAN.md` and this task list.
- [ ] Confirm project hostname: `xivflips.projects.blueskye.co.uk`.
- [ ] Confirm XIVAuth OAuth client details can be created or supplied.
- [ ] Confirm hard-login requirement: only `/` is public; every other route and API feature requires login.
- [ ] Confirm daily xivarbitrage snapshot worker is acceptable for MVP, with no real-time alerts.

Acceptance check:

- Human approval received before implementation starts.

## Phase 1: Repository And Workspace Bootstrap

- [ ] Initialize git repository in the project directory.
- [ ] Create descriptive README before first commit.
- [ ] Create pnpm workspace layout: `apps/api`, `apps/web`, `packages/shared`, `drizzle`.
- [ ] Add root `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, TypeScript base config.
- [ ] Add oxlint and oxfmt configuration.
- [ ] Add Husky pre-commit hook for lint/format checks.
- [ ] Add commitlint config for Conventional Commits.

Acceptance check:

- `pnpm install` succeeds.
- `pnpm lint`, `pnpm format`, and `pnpm build` scripts exist at the root.
- Initial commit is signed and uses a Conventional Commit message.

## Phase 2: Shared Package

- [ ] Create `@xivflips/shared` package.
- [ ] Define common enums: flip status, listing status, strategy.
- [ ] Define zod schemas for API inputs and outputs.
- [ ] Define shared TypeScript DTOs.
- [ ] Implement pure profit calculation functions.
- [ ] Add unit tests for full sale, partial sale, unsold inventory, tax, zero quantity, and negative/invalid inputs.

Acceptance check:

- Shared package builds independently.
- Profit math tests pass.

## Phase 3: Database Foundation

- [ ] Add Drizzle ORM and `pg` database driver.
- [ ] Define schema for `users`, `items`, `worlds`, `flips`, `purchases`, `listings`, `sales`, `watchlist_items`, and `market_snapshots`.
- [ ] Add SQL migrations.
- [ ] Add database client module.
- [ ] Add migration script.
- [ ] Add `.env.example` with all required API and frontend variables.
- [ ] Create local PostgreSQL database/user after implementation starts.

Acceptance check:

- Migrations apply cleanly to a local PostgreSQL database.
- Schema includes user ownership constraints and useful indexes.

## Phase 4: API Bootstrap

- [ ] Create `@xivflips/api` Hono package.
- [ ] Add Node server entrypoint with configurable `PORT`.
- [ ] Add route modules and shared error handling.
- [ ] Add request logging appropriate for production.
- [ ] Add `GET /api/health` with database check.
- [ ] Add static file serving strategy or document Caddy static hosting decision.

Acceptance check:

- API starts locally.
- `GET /api/health` returns healthy status when database is available.

## Phase 5: XIVAuth API Security

- [ ] Add XIVAuth OAuth callback and signed app session middleware using `jose`.
- [ ] Validate signed app sessions.
- [ ] Add local user creation/linking on XIVAuth login.
- [ ] Add `GET /api/me`.
- [ ] Add `PATCH /api/me/settings`.
- [ ] Add tests or fixtures for authenticated and unauthenticated API calls.

Acceptance check:

- All protected API routes reject missing/invalid sessions.
- Valid XIVAuth logins map to local users.

## Phase 6: Metadata And Market Services

- [ ] Add xivarbitrage API client with base URL env var.
- [ ] Add item metadata normalization service.
- [ ] Add world/data-center metadata refresh service.
- [ ] Add market snapshot normalization for listings/history responses.
- [ ] Add safeguards for xivarbitrage API failures and partial results.
- [ ] Add fixture-based tests for normalization.

Acceptance check:

- Service can fetch and normalize one tracked item without touching UI code.
- Failed external calls are logged and isolated.

## Phase 7: Daily Snapshot Worker

- [ ] Add worker command `pnpm --filter @xivflips/api market:snapshot`.
- [ ] Query active flips and watchlist items for distinct item/world/data-center targets.
- [ ] Fetch xivarbitrage listings/history for each target.
- [ ] Upsert item/world metadata.
- [ ] Insert daily market snapshots.
- [ ] Add summary logging: checked, inserted, skipped, failed, duration.
- [ ] Add retention cleanup using `MARKET_SNAPSHOT_RETENTION_DAYS`.
- [ ] Document cron/systemd/pm2 scheduling.

Acceptance check:

- Worker runs once and exits successfully.
- Running worker twice in one day does not create uncontrolled duplicate snapshots.

## Phase 8: Flip API Routes

- [ ] Implement `GET /api/dashboard`.
- [ ] Implement `GET /api/flips` with status/search filters.
- [ ] Implement `POST /api/flips` with optional initial purchase.
- [ ] Implement `GET /api/flips/:id`.
- [ ] Implement `PATCH /api/flips/:id`.
- [ ] Implement `DELETE /api/flips/:id` archive/delete behavior.
- [ ] Implement purchase CRUD routes.
- [ ] Implement listing CRUD routes.
- [ ] Implement sale CRUD routes.
- [ ] Ensure every query is scoped to the authenticated user.

Acceptance check:

- A user can create a flip, add purchase/listing/sale records, and see updated profit metrics.
- A user cannot access another user's records.

## Phase 9: Watchlist API Routes

- [ ] Implement `GET /api/watchlist`.
- [ ] Implement `POST /api/watchlist`.
- [ ] Implement `PATCH /api/watchlist/:id`.
- [ ] Implement `DELETE /api/watchlist/:id`.
- [ ] Attach latest market snapshot to watchlist responses.
- [ ] Implement optional `POST /api/market/refresh` for a single tracked item.

Acceptance check:

- A user can manage watchlist targets and view latest daily snapshot age/value.

## Phase 10: Web Bootstrap

- [ ] Create `@xivflips/web` Vite React package.
- [ ] Add Mantine provider, notifications, theme, and global CSS.
- [ ] Add XIVAuth login flow.
- [ ] Add API client that sends app session cookies.
- [ ] Add TanStack Query provider.
- [ ] Add routing.
- [ ] Add public landing page at `/`.
- [ ] Add protected app shell for all non-root routes.

Acceptance check:

- Unauthenticated users can only view `/`.
- Authenticated users can reach `/dashboard`.

## Phase 11: Mobile-First UI Flows

- [ ] Build mobile bottom navigation.
- [ ] Build dashboard summary cards.
- [ ] Build flip list as cards with filter chips.
- [ ] Build new flip form with sticky save action.
- [ ] Build flip detail timeline for purchases, listings, and sales.
- [ ] Build add/edit purchase modal or page.
- [ ] Build add/edit listing modal or page.
- [ ] Build add/edit sale modal or page.
- [ ] Build watchlist list and edit form.
- [ ] Build settings page.
- [ ] Add desktop enhancements only after mobile flows work.

Acceptance check:

- Primary flows are usable at 390px width without horizontal scrolling.
- Tap targets are comfortable and forms are fast to complete on mobile.

## Phase 12: UX Polish And Observability

- [ ] Add loading, empty, and error states for every primary route.
- [ ] Add optimistic updates where safe.
- [ ] Add clear market snapshot age indicators.
- [ ] Add confirmation for destructive actions.
- [ ] Add human-readable gil formatting.
- [ ] Add accessible labels and keyboard focus states.
- [ ] Add basic structured API logs.

Acceptance check:

- No primary route has a blank loading or failure state.
- Snapshot staleness is visible in dashboard, flip detail, and watchlist views.

## Phase 13: Verification

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm format`.
- [ ] Run `pnpm test:run`.
- [ ] Run `pnpm build`.
- [ ] Run API health check locally.
- [ ] Run market snapshot worker locally with a small target set.
- [ ] Manually test XIVAuth login/logout.
- [ ] Manually test mobile viewport flows.

Acceptance check:

- All verification commands pass or documented blockers are accepted.

## Phase 14: Deployment

- [ ] Create production PostgreSQL database/user.
- [ ] Apply migrations in production.
- [ ] Configure XIVAuth production callback URL.
- [ ] Build web and API.
- [ ] Configure pm2 API process.
- [ ] Configure Caddy/static serving/reverse proxy.
- [ ] Configure daily worker schedule.
- [ ] Verify production health endpoint.
- [ ] Verify production login.
- [ ] Add project to `/home/skye/dev/projects/projects.blueskye.co.uk/public/projects.json` after site is live.
- [ ] Build project registry.

Acceptance check:

- `https://xivflips.projects.blueskye.co.uk` serves the landing page.
- Authenticated app works in production.
- Daily worker schedule is active.
- Project registry includes XIV Flips after deployment.

## Phase 15: GitHub And Finalization

- [ ] Create GitHub repository if requested/appropriate.
- [ ] Add `Flickwire` as admin collaborator for a new repo.
- [ ] Push commits to GitHub.
- [ ] Confirm clean git status.
- [ ] Report deployment URL, XIVAuth status, database status, worker schedule, commits, and any blockers.

Acceptance check:

- Final report includes git status, commits, push status, URL, tests, and remaining follow-ups.
