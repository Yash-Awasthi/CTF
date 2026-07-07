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

## Personalization & seed engine (Phase 4)

Deterministic, cryptographic per-participant personalization. All of it is
**server-only** (`src/lib/crypto/`) — no secret, key, seed, or RNG state ever
reaches the browser; the client receives only rendered challenge content.

**Derivation hierarchy** (each stage's HMAC *key* is the previous stage's output,
so `EVENT_SECRET` is never fed directly into RNG or challenge derivation):

```text
EVENT_SECRET (runtime env, resolved by secret_version)
  └─ eventKey        = HMAC(secret,          frame[ "case-files:event-key:v1",       secretVersion, slug ])
       ├─ participantSeed = HMAC(eventKey,        frame[ "case-files:participant-seed:v1", rollNumber ])
       │    └─ challengeSeed  = HMAC(participantSeed, frame[ "case-files:challenge-seed:v1",  slot ])
       │         └─ RNG block  = HMAC(challengeSeed,  frame[ "case-files:rng-block:v1",       counter ])
       └─ attributionSeed = HMAC(eventKey,       frame[ "case-files:attribution:v1",     slot ])
```

- **Secret-version resolution** (`secrets.ts`): D1 stores only `secret_version`
  (e.g. `v1`). `resolveEventSecret(env, version)` maps a version → runtime binding
  via `SECRET_VERSION_BINDINGS` (`v1 → EVENT_SECRET`). Unknown version or
  missing/empty binding **throws** (`SecretResolutionError`) — no fallback to
  another version, no default secret, and error messages never contain the value.
  Future versions = one map entry + one new `wrangler secret put` binding.
- **Stable identities only.** Event identity = `slug` (unique, immutable);
  challenge identity = **slot** (`1..30`), never the autoincrement DB `id` (which
  is environment-dependent). Same logical event/challenge → identical seeds after
  a clean migrate + reseed. No time, no event state, no DB row ids enter derivation.
- **Domain separation + framing** (`constants.ts`, `encoding.ts`): every stage
  has an explicit versioned label; every HMAC input is `frame([...])` — 4-byte
  big-endian length-prefixed chunks, so `frame([a,b])` can never collide with a
  different split. No naive `slug + roll + slot` concatenation anywhere.
- **Deterministic RNG** (`rng.ts`): counter-based HMAC expansion —
  `block(i) = HMAC(challengeSeed, frame["rng-block", i])`, 32 bytes each. The key
  is imported once per instance; the counter + partial-block leftover are **local**
  to the instance, so two RNGs from the same seed reproduce the identical stream
  and one can never perturb another. No `Math.random`, no `Date`, no globals.
- **Unbiased integers** (`int(min, max)`): rejection sampling — draw enough bytes,
  reject the tail above the largest multiple of the range, then map. No `% range`
  bias. Helpers: `bytes`, `int`, `choice`, `shuffle` (Fisher-Yates), `sample`
  (partial F-Y, no replacement), `string(len, alphabet)`. All deterministic,
  none mutate inputs, all validate edge cases.
- **Ordinary vs attribution personalization** — two separate systems.
  *Ordinary* reads a participant/challenge RNG and may collide across participants
  (names, dates, filenames…). *Attribution-enabled* (`attribution.ts`) assigns each
  participant a **unique** answer so a copied answer identifies its source: a
  deterministic **bijection**, not retry-until-unique. Participants in canonical
  order (roll ascending), answers normalized + validated unique, shuffled under a
  per-challenge `attributionSeed`, zipped. `buildOwnershipMap()` yields
  `normalizedAnswer → rollNumber` for Phase 8. Uniqueness is judged **after**
  `normalizeAnswer` (`src/lib/validation/answer.ts`, the shared submission rule),
  so `TOM`/`tom`/` Tom ` are one answer. Invalid pools throw **before** the event runs.

**Environment:** Phase 4 adds no new required variables — `v1` resolves to the
existing `EVENT_SECRET` (`.dev.vars` locally, `wrangler secret put` in prod).
A future `v2` would add `EVENT_SECRET_V2` (or similar) plus a map entry.

**Test vectors:** fixed development-only inputs assert exact expected event/
participant/challenge/attribution seeds + first RNG block + int/string/shuffle
(`tests/unit/crypto-*.test.ts`), so an accidental algorithm change fails loudly.
Coverage test derives all **116 × 30 = 3,480** combinations (unique, reproducible).

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
