# PROGRESS

Read `ctf-build-plan.md` (source of truth, already corrected). This file = per-phase memory only.

## Rules
1. One phase at a time, in order. Stop after each; wait for confirmation before next.
2. Decision not in the plan → ask in chat (don't assume).
3. Phase 13 content: don't start until the 3 open items are answered.
4. Commit + push each phase to `origin/main` (github.com/Yash-Awasthi/CTFplayground).

## Status
- Phase 0 ✅ · Phase 1 schema ✅ · Phase 2 auth ✅ · Phase 3 event lifecycle+timer ✅ · Phase 4 personalization/seed engine ✅ · Phase 5 challenge engine ✅ · Phase 6 scoring engine ✅ · **Phase 7 hints + submission integration ✅ (awaiting confirm)**
- Next: Phase 8 (anti-cheat attribution — ownership index on wrong submissions).

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
- Scoring in `src/lib/scoring/` (server-only). LOCKED formula `score=base×time_factor×hint_factor` — never redesign. Single source `calculate.ts`; routes consume, never re-impl.
- Milli-points integer only. `final_score=round(base×tf×hf×1000)` SINGLE rounding over exact int fractions (roundDiv), not from pre-rounded per-mille. No floats in D1.
- time_factor=max(0.5,1-(elapsed/duration)×0.5) per-mille 500..1000; elapsed clamped [0,duration]→floors 500. elapsed from `deriveElapsedSeconds(event, solvedAt)` (server started_at only, never client time).
- hint_factor binary: 1000 none / 500 any hint (once; both hints still single 0.5). Absolute floor 0.25×base.
- `recordSolve` idempotent: insert solves onConflictDoNothing+returning (Phase1 UNIQUE event/participant/challenge); increment participants.score ONLY when new row created → no double-add. solves.final_score authoritative; participants.score cached aggregate. `recomputeParticipantScore`/`verifyParticipantScore` = consistency path.
- `getLeaderboard` uses PERSISTED participants.score DESC; tie fallback earliest final solve MAX(solved_at) ASC (no-solves last), then roll ASC. No schema change (Phase1 fields already present).
- Submission deferred from Phase 5 → done in Phase 7. `POST /api/submit` thin route → `src/lib/submission/processSubmission` (orchestrator; reuses engine validate + scoring recordSolve, never re-impl). `POST /api/hint` → `src/lib/hints`.
- processSubmission: only CURRENT slot submittable (locked/solved rejected). Persist EVERY attempt in submissions (correct+incorrect) for Phase 8. hint_used derived ONLY from hint_usage (client never sends). recordSolve idempotent; advance = conditional UPDATE current_challenge=slot+1 WHERE current=slot (race-safe, self-heals crash-before-advance, decoupled from created). Slot 30 saturates at 30, completion from solve row.
- Hints: max 2, strict order (reveal only count+1; re-reveal idempotent; skip-ahead→409 out_of_order). hint_usage UNIQUE(event,participant,challenge,hint_number) onConflictDoNothing. First hint locks hint_factor 0.5 permanent; second no stack. Content returned only after persisted reveal. Hint reveal allowed only status==='current'.
- Submit/hint responses expose no answer/privateData/seed/ownership. Challenge page inline <script> does fetch to /api/submit,/api/hint; revealed hints server-rendered (survive refresh); solved slot read-only.
- E2E gotcha: stale `astro dev` daemon (reuseExistingServer) can serve OLD code + break after `db:reset:local` wipes local D1 → ALL logins timeout. Fix: kill stale astro dev PID, let Playwright start fresh. (First-test cold-compile flake still separate; warm rerun green.)

## Local dev / test
- `pnpm db:reset:local` (wipe+migrate+seed) → dev event slug `case-files-dev-2026`, state `READY`, rolls 25115000–25115115.
- `pnpm test` (vitest, in-memory better-sqlite3) · `pnpm build` · `pnpm test:e2e` (Playwright; needs `pnpm dev` running — it daemonizes, `astro dev stop` to kill).
- UI uses native form POST (no client-JS dependency); login/logout APIs also accept JSON.
