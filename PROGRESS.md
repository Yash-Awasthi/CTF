# PROGRESS

Read `ctf-build-plan.md` (source of truth, already corrected). This file = per-phase memory only.

## Rules
1. One phase at a time, in order. Stop after each; wait for confirmation before next.
2. Decision not in the plan → ask in chat (don't assume).
3. Phase 13 content: don't start until the 3 open items are answered.
4. Commit + push each phase to `origin/main` (github.com/Yash-Awasthi/CTFplayground).

## Status
- Phase 0 ✅ · Phase 1 schema ✅ · Phase 2 auth ✅ · Phase 3 event lifecycle+timer ✅ · Phase 4 personalization/seed engine ✅ · **Phase 5 challenge engine ✅ (awaiting confirm)**
- Next: Phase 6 (submission + scoring).

## Non-obvious facts (not in the plan)
- Project name `case-files`. Bindings: `DB` (D1), `BUCKET` (R2), `ASSETS` (CF static).
- Runtime env access: `getEnv()` in `src/lib/runtime.ts` (via `cloudflare:workers`). `Astro.locals.runtime.env` is REMOVED in Astro 7 — do not use.
- Secrets in `.dev.vars` (gitignored): `EVENT_SECRET`, `RATE_LIMIT_SECRET`. Regen types after wrangler.jsonc change: `pnpm generate-types`.
- Scores = integer milli-points; time/hint factors = integer per-mille. No floats persisted.
- One-active-session enforced by partial unique index on `sessions(participant_id) WHERE revoked_at IS NULL`.
- Astro `session.driver: memory()` + `imageService: 'passthrough'` set only to avoid unused KV/IMAGES bindings.
- Perms: `.claude/settings.local.json` = bypassPermissions (gitignored).
- Event lifecycle centralized in `src/lib/event/` (`state.ts` transitions/extend/expiry, `timer.ts`, `access.ts`). Never write `events.state` directly — use the service.
- Timing canonical: `endsAt = started_at + duration_seconds` (no separate ends_at). Max total duration 6h (`MAX_EVENT_DURATION_SECONDS=21600`).
- Expiry is LAZY: `ensureCurrentEventState()` freezes an expired LIVE event on the next request (no cron/SSE). Idempotent via conditional `WHERE state='LIVE'`.
- Timer API: `GET /api/event/state` (auth). Browser countdown display-only, resyncs on refresh.
- Login policy single source: `event/access.ts canParticipantLogin` (auth `isLoginAllowed` delegates).
- Personalization engine in `src/lib/crypto/` (server-only). Hierarchy: secret→eventKey→participantSeed→challengeSeed; attributionSeed hangs off eventKey (per-challenge, all participants). Keys chain (each stage keys HMAC with prior output) — EVENT_SECRET never RNG input.
- Stable identity ONLY: event=`slug`, challenge=`slot` (1..30), NEVER DB autoincrement id. No time/state/row-id in derivation.
- HMAC inputs always `frame([...])` (4-byte BE length-prefixed) — never naive concat. Domain labels in `crypto/constants.ts` (`case-files:*:v1`); bump label + test vectors if algo changes.
- RNG = counter HMAC expansion, key imported once/instance, counter+leftover local (no shared/global state). Async methods (Web Crypto). `int()` = rejection sampling (no modulo bias). Helpers: bytes/int/choice/shuffle/sample/string.
- Secret resolution: `resolveEventSecret(env, version)` via `SECRET_VERSION_BINDINGS` (`v1→EVENT_SECRET`). Unknown/missing → throw, no fallback/default, value never in error. Add version = 1 map entry + 1 binding. No new env var in Phase 4.
- Attribution = deterministic bijection (shuffle answers under attributionSeed, zip to roll-ascending), NOT retry-until-unique. Uniqueness judged AFTER `normalizeAnswer` (validation/answer.ts — shared submission rule). `buildOwnershipMap` → normalizedAnswer→roll for Phase 8. Invalid pool throws pre-event.
- Stable test vectors hardcoded in `tests/unit/crypto-derive.test.ts`/`crypto-rng.test.ts` (fixed dev secret `test-vector-secret-DO-NOT-USE-0000`, slug dev, roll 25115000, slot 7). Coverage test = full 116×30=3480.
- Secrets server-only: `dist/client/` clean; secret value only in `dist/server/.dev.vars` (dev-only, gitignored src). No crypto/seed strings in client bundle.
- Challenge engine in `src/lib/challenges/` (server-only). Contract `types.ts`; explicit self-validating `registry.ts` (no fs scan / no dynamic import); `engine.ts` orchestrates registry+crypto+attribution+normalize+validate.
- Placeholders `placeholders.ts` = 30 DEV-only modules via factory, answers prefixed `DEV-PLACEHOLDER` (not real content). Attribution slots = 8,16. Real modules swap the array later, engine unchanged.
- Stable challenge identity = SLOT (1..30). DB autoincrement `challenges.id` = FK target only (submissions/solves), never crypto/logic identity.
- Source of truth: CODE owns behavior+metadata (key/title/basePoints/tier/attribution/hints/generate/validate); D1 row owns operational identity (id/event_id/slot + mirrored tier/base_points/attribution_enabled). Join = (event_id, slot). `syncChallengeRows` upsert (idempotent); `validateChallengeConsistency` asserts agreement. seed-dev.sql seeds 30 rows.
- Public/private boundary: `getPublicChallengeData()` projects only safe keys (slot/key/title/tier/basePoints/attributionEnabled/publicData). Routes serialize THAT, never raw instance. privateData.answer server-only.
- Progression: `participants.current_challenge` = unlocked slot (start 1). <current=solved, =current, >current=locked. Advance to min(N+1,30) on solve (Phase 6). Single source: `access.ts getChallengeAccessStatus/canAccessChallenge/assertChallengeAccess`. NO solve advancement in Phase 5.
- Routes: `/<event>/challenge/<slot>` page + `GET /api/challenges/<slot>` — same chain (auth→LIVE→slot valid→progression→public-only). Invalid slot 404; locked 403(API)/redirect-to-current(page). LIVE home links current challenge. Modules never touch EVENT_SECRET (consume Phase 4 high-level API only).
- E2E cold-start: first Playwright test can exceed 30s per-test timeout on cold `astro dev` compile (pre-existing). Re-run warm → green. Not a Phase 5 defect.

## Local dev / test
- `pnpm db:reset:local` (wipe+migrate+seed) → dev event slug `case-files-dev-2026`, state `READY`, rolls 25115000–25115115.
- `pnpm test` (vitest, in-memory better-sqlite3) · `pnpm build` · `pnpm test:e2e` (Playwright; needs `pnpm dev` running — it daemonizes, `astro dev stop` to kill).
- UI uses native form POST (no client-JS dependency); login/logout APIs also accept JSON.
