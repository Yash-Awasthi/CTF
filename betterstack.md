# Better Stack: CTF (Case Files)

Upgrade plan built from the code itself (`package.json`, `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json`, the import graph across `src/`, `tests/` and `scripts/`, and CI). Target versions were read from the npm registry and nodejs.org on 2026-10-12. "Newest" includes beta/RC builds; "Stable" is the newest final release.

## What the code actually uses

- Astro 7 in `output: 'server'` mode on Cloudflare Workers via `@astrojs/cloudflare`, with D1 as the only datastore (`wrangler.jsonc`).
- ~23k lines of TypeScript and `.astro`. All interactivity is plain TS in `src/scripts/*.ts`; there are **zero** `.tsx`/`.jsx` files and **zero** `client:*` directives.
- Drizzle ORM (37 imports): the D1 driver at runtime, the `better-sqlite3` driver in unit tests (12 test files).
- Own auth stack (`src/lib/auth`): PBKDF2-SHA256 at 100,000 iterations via WebCrypto, D1-backed sessions, HMAC'd-IP rate limiting.
- Zod 4 in three validation modules.
- Live updates (`src/pages/api/events/stream.ts`): an SSE stream that **re-queries D1 every 4 s per connected client**, closes after ~80 s and relies on `EventSource` reconnects.
- Vitest for unit tests, Playwright for e2e, Tailwind 4 via the Vite plugin.

## Dead weight to delete first

| Item | Evidence | Action |
|---|---|---|
| `react`, `react-dom`, `@astrojs/react`, `@types/react`, `@types/react-dom` | No React component exists; the only "react" strings are code templates in `src/lib/auth_generator.ts` | Remove the packages and `integrations: [react()]` |
| `src/lib/auth_generator.ts` | Imported nowhere; it generates `better-auth` boilerplate, but `better-auth` is not a dependency and auth is home-grown | Delete |
| `tsconfig.json` `paths` entry for `better-auth/adapters/drizzle`, `jsx`, `jsxImportSource` | Point at a package that is not installed; no JSX in the project | Delete |
| `@cloudflare/workers-types` | Referenced nowhere; `pnpm generate-types` (`wrangler types`) already produces `worker-configuration.d.ts`, which `tsconfig` includes | Remove, and run `wrangler types` in CI before `tsc` |
| `version: "3.8"` in `docker-compose.yml` | Ignored by Compose v2 | Delete; also bump the `node:22.6-alpine` image |

Removing React shrinks install size and the server bundle, and drops a class of hydration bugs that cannot occur here anyway.

## Upgrades

| Package | Current | Stable | Newest | Pick |
|---|---|---|---|---|
| Node.js (engines, CI, compose image) | 22 | 24.21.0 LTS | 26.11.1 | **26** (LTS this month), `engines >=24` |
| pnpm | 11.21.0 | 12.11.2 | 12.11.2 | **12.11.2** (`packageManager` field) |
| `astro` | ^7.3.5 | 7.3.8 | 7.4.0-beta.1 | **7.4.0-beta.1** |
| `@astrojs/cloudflare` | ^14.3.3 | 14.3.4 | 15.0.0-beta.1 | **15.0.0-beta.1** (pair with Astro 7.4 beta; fallback 14.3.4) |
| `@astrojs/check` | ^0.9.10 | 0.9.10 | 0.9.10 | keep |
| `wrangler` | ^4.142.0 | 4.149.0 | 4.149.0 | **4.149.0**; move to `devDependencies` (it is a CLI, not a runtime import) |
| `compatibility_date` | 2026-07-07 | | | **2026-10-12** after a full e2e pass |
| `drizzle-orm` / `drizzle-kit` | 0.45.2 / 0.31.10 | 0.45.4 / 0.31.11 | 1.0.0-rc.4 | **1.0.0-rc.4** for both |
| `zod` | ^4.4.3 | 4.6.7 | 4.6.7 | **4.6.7** |
| `tailwindcss` / `@tailwindcss/vite` | ^4.3.2 | 4.3.3 | 4.3.3 | **4.3.3** |
| `typescript` | ^6.0.3 | 7.0.2 | 7.1.0-dev | **7.0.2** (the Go-native compiler) |
| `vitest` | ^4.1.10 | 5.0.4 | 5.0.4 | **4.1.11** for now (see below), then 5.x |
| `@playwright/test` | ^1.61.1 | 1.64.0 | 1.65.0-alpha | **1.64.0** |
| `better-sqlite3` | ^12.11.1 | 13.0.3 | 13.0.3 | **13.0.3**, or remove (see below) |
| `@types/node` | ^26.1.0 | 26.6.5 | 26.6.5 | **26.6.5** |
| `tsx` | ^4.23.15 | 4.23.15 | 4.23.15 | keep, or drop for native `node script.ts` on Node ≥ 24 |

Notes tied to this code:

- **Drizzle 1.0 RC.** The project uses the SQLite dialect with D1 and better-sqlite3 drivers plus generated migrations under `migrations/`. 1.0 changes the migration folder layout and the relational query API. Run `drizzle-kit up` to convert `migrations/meta`, then diff the generated SQL against the existing `0000`–`0004` files before applying anything to the remote D1.
- **TypeScript 7.** `tsc` in CI (`npx tsc --noEmit`) becomes much faster. `astro check` still runs on the TS language service, so keep `typescript` 7 and confirm `@astrojs/check` accepts it. If it does not, install `@typescript/native-preview` for CI `tsc` only.
- **Vitest and the Workers pool.** The best test setup for this repo is `@cloudflare/vitest-pool-workers` (0.23.0). It runs tests inside `workerd` against a real local D1, replacing the better-sqlite3 stand-in and the dual-driver typing in `src/lib/db/client.ts` and `seed.ts`. It currently peers on `vitest ^4.1`, so move to Vitest 4.1.11 with the pool first. Take Vitest 5 when the pool supports it.
- **Native TS scripts.** `scripts/create-event.ts` runs through `tsx`. Node 24+ strips types natively, so `node scripts/create-event.ts` works if the script avoids enums and parameter properties.

## Architecture upgrades

### Live updates: Durable Object + WebSocket hibernation instead of D1 polling

Each SSE connection reads D1 every 4 s, which is 2+ queries per participant every tick. With 200 players that is about 100 D1 reads per second doing nothing, and first-blood latency is up to 4 s.

Better: one Durable Object per event that owns the live state.

- Submissions and admin announcements write to D1 as today, then `stub.broadcast(...)` the DO.
- Clients connect over WebSocket to the DO using the hibernation API (`ctx.acceptWebSocket`), so idle sockets cost nothing.
- Reconnect recovery stays the same: clients send their `fb`/`ann` cursors and the DO replays from D1.
- Keep the SSE route as a fallback for networks that block WebSockets.

This also removes the "Cross-isolate correctness comes from each stream reading D1 itself" workaround described in `stream.ts`: the DO is the single coordination point.

### Rate limiting

`src/lib/auth/rate-limit.ts` stores failures in a D1 table. Workers now has a native Rate Limiting binding (`ratelimits` in `wrangler.jsonc`), which needs no table, no cleanup and no write per attempt. Keep the D1 table only for the audit trail.

### Password hashing

PBKDF2 at 100k iterations is the WebCrypto ceiling on Workers, but it is well under the current OWASP guidance for PBKDF2-SHA256 (600k). The format already stores the iteration count, so this can change later. Options:

- Argon2id via a WASM build (for example `hash-wasm`), with a rehash-on-login migration.
- Or accept 100k and lean on the rate limiter (already HMAC'd per IP and per account).

## CI (`.github/workflows/ci.yml`)

| Action | Current | Latest |
|---|---|---|
| `actions/checkout` | v4 | v7.0.1 |
| `pnpm/action-setup` | v4 | v6.1.0 |
| `actions/setup-node` | v4, Node 22 | v7.1.0, Node 26 |

Add `pnpm generate-types` before `tsc`, and `astro check` as a separate step.

## Order of work

1. Remove React, `auth_generator.ts`, stale `tsconfig` entries and `@cloudflare/workers-types`; `pnpm build && pnpm test`.
2. Node 26 / pnpm 12 / CI actions.
3. Patch bumps: Astro 7.3.8, wrangler, Zod, Tailwind, Playwright, `@types/node`.
4. TypeScript 7.
5. Vitest 4.1.11 + `@cloudflare/vitest-pool-workers`; retire better-sqlite3 from tests.
6. Drizzle 1.0 RC with a migration diff review on local D1.
7. Durable Object live-update channel, then the Rate Limiting binding.
8. Astro 7.4 beta + Cloudflare adapter 15 beta, then bump `compatibility_date`.

Each step should leave `pnpm test`, `tsc --noEmit`, `pnpm build` and the Playwright suite green.
