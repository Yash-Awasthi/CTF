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
