# case-files — Internet Investigation CTF

Beginner-friendly, seeded-per-participant CTF. 30 sequential challenges (OSINT,
source inspection, beginner SQLi, encoding, light forensics). Individual play,
~40+ participants, roll-number login.

**Stack:** Astro + TypeScript (strict) · React islands · Tailwind v4 ·
Cloudflare Workers · D1 · R2 · Drizzle · Zod · Vitest · Playwright · pnpm.

Build proceeds phase-by-phase per [`ctf-build-plan.md`](./ctf-build-plan.md).
Scoring: `score = base_points × time_factor × hint_factor`.

## Prerequisites

- Node ≥ 22.12, pnpm 9
- A Cloudflare account (free tier) for D1/R2 — only needed from Phase 1 on.

## Local dev

```sh
pnpm install
cp .env.example .dev.vars   # local secrets for `wrangler dev` (git-ignored)
pnpm dev                    # Astro dev server → http://localhost:4321
```

## Cloudflare resources (one-time)

Bindings are declared in `wrangler.jsonc` (`DB` → D1, `BUCKET` → R2,
`ASSETS` → Astro static output). Create the backing resources and paste the
returned IDs into `wrangler.jsonc`:

```sh
# Authenticate once
pnpm wrangler login

# D1 database — copy the printed database_id into wrangler.jsonc → d1_databases[0].database_id
pnpm wrangler d1 create case-files-db

# R2 bucket
pnpm wrangler r2 bucket create case-files-assets

# Regenerate typed bindings after editing wrangler.jsonc
pnpm generate-types
```

### Database (D1) — schema, migrations, seed

Drizzle schema is the source of truth: `src/lib/db/schema.ts` (12 tables, multi-event,
all keyed on `event_id`; surrogate integer IDs are the FK targets; roll number is a
per-event login identity, never a global key). Generated SQL lives in `migrations/`.

```sh
pnpm db:generate        # drizzle-kit generate → SQL migration into migrations/
pnpm db:migrate:local   # apply migrations to local D1 (miniflare)
pnpm db:seed:local      # seed the dev event + 116 participants (25115000–25115115)
pnpm db:reset:local     # wipe local D1, re-migrate, re-seed (clean slate)
pnpm db:migrate:remote  # apply migrations to production D1
```

Seeding is **event-scoped**: `scripts/seed-dev.sql` creates one dev event and inserts
the roster *into that event*. The reusable programmatic path is `seedEvent(db, opts)`
in `src/lib/db/seed.ts` — the roster (roll range) is a parameter, so future events can
use different rosters. Verify a local seed:

```sh
pnpm exec wrangler d1 execute case-files-db --local \
  --command "SELECT count(*) FROM participants;"   # → 116
```

Scores are stored as **integer milli-points** (1 pt = 1000 units); time/hint factors as
integer per-mille (0.5 → 500) — no floats persisted (see build spec "Score precision").

## Authentication (Phase 2)

Event-scoped, roll-number login. Username = password = roll number, validated by
**participant lookup within the event** (never a global range). Public event
identity is the **slug**; internal ids are never exposed.

- **Login page:** `/<event-slug>/login` (e.g. `/case-files-dev-2026/login`).
- **Protected page:** `/<event-slug>/home` — redirects to login if unauthenticated.
- **APIs:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/session`
  (401 JSON when unauthenticated). Login/logout accept **JSON** (programmatic) or
  a **native form POST** (the UI uses this — works without client JS; 303 redirects).

Sessions: a 256-bit CSPRNG opaque token in an `HttpOnly`, `SameSite=Lax`,
`Secure`-in-prod cookie; the DB stores only `SHA-256(token)`. **One active session
per participant** is enforced by a partial unique index
(`sessions(participant_id) WHERE revoked_at IS NULL`) — a new login revokes the
old one. No inactivity logout; sessions last 12h or until logout/replacement/expiry.
Login is allowed only when the event state is `READY`, `LIVE`, or `FROZEN`.

Login is rate-limited (persistent D1 table `login_rate_limit`): 10 failures / 5 min
per roll and per client IP → temporary cooldown (never a permanent lock; success
clears it). IPs are stored only as `HMAC(ip, RATE_LIMIT_SECRET)` — raw IPs are never
persisted. Set `RATE_LIMIT_SECRET` (distinct from `EVENT_SECRET`) in `.dev.vars`.

E2E note: `pnpm test:e2e` runs against the Astro dev server; if it isn't already
running, start it once with `pnpm dev` (it daemonizes) and re-run.

## Event lifecycle & timing (Phase 3)

State machine `DRAFT → READY → LIVE → FROZEN → REVIEW → RESULTS_PUBLISHED → ARCHIVED`
(strictly forward-only). All changes go through the centralized service in
`src/lib/event/` (`state.ts`) — application code never writes `events.state`
directly. Operations: `markEventReady`, `startEvent`, `freezeEvent`,
`beginEventReview`, `publishEventResults`, `archiveEvent`, `extendEvent`,
`setEventDuration`. Every mutation writes an `admin_actions` audit row.

**Server time is authoritative.** Canonical timing: `endsAt = started_at +
duration_seconds` (no separate `ends_at`). `getEventTiming()` derives
remaining/elapsed/isLive/hasEnded. Max **total** duration is 6h
(`MAX_EVENT_DURATION_SECONDS = 21600`); `extendEvent` adds time only up to that cap.

**Lazy expiry** (no cron/SSE, zero-cost): `ensureCurrentEventState()` atomically
freezes an expired LIVE event on the next request that touches it — idempotent via
a conditional `UPDATE … WHERE state='LIVE'`. The event is functionally over at
`ends_at` because every protected op checks authoritative time, even before the
persisted freeze lands. The browser countdown is display-only and resyncs on refresh.

- **Timer API:** `GET /api/event/state` (authenticated) → state + authoritative
  timing (never exposes `secret_version`).
- **Participant page** `/<event>/home` is state-aware: waiting room (READY),
  live placeholder + countdown (LIVE), ended/under-review (FROZEN/REVIEW).
- Access policies live in `src/lib/event/access.ts` (`canParticipantLogin`,
  `canAccessWaitingRoom`, `canAccessCompetition`, `canSubmit`, `canViewFinalResults`).

## Commands

| Command | Action |
| :-- | :-- |
| `pnpm dev` | Dev server at `localhost:4321` |
| `pnpm build` | Production build to `./dist/` |
| `pnpm preview` | Preview the build locally |
| `pnpm test` | Vitest unit suite |
| `pnpm test:e2e` | Playwright end-to-end |
| `pnpm generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |

## Layout

```text
src/
├── layouts/            # shared Astro layouts
├── components/         # Astro + React islands
├── middleware/         # session/auth middleware (Phase 2)
├── pages/              # routes; pages/api for endpoints
└── lib/
    ├── auth/           # login, sessions, rate limiting
    ├── anti-cheat/     # copied-answer attribution
    ├── challenges/     # challenge engine + interface
    ├── crypto/         # seed/HMAC/PRNG helpers
    ├── db/             # Drizzle schema + client
    ├── event/          # event state machine + timer
    ├── scoring/        # scoring formula
    └── validation/     # Zod schemas / answer normalization
challenges/             # per-challenge content, 01..29 + 30-final
tests/{unit,e2e}/       # Vitest + Playwright
```

## Secrets

`EVENT_SECRET` seeds all per-participant personalization. It is frozen once the
event starts and never committed or logged. Local value lives in `.dev.vars`;
production value is set with `pnpm wrangler secret put EVENT_SECRET`.
