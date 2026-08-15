# PROGRESS

Read `ctf-build-plan.md` (source of truth, already corrected). This file = per-phase memory only.

## Rules
1. One phase at a time, in order. Stop after each; wait for confirmation before next.
2. Decision not in the plan → ask in chat (don't assume).
3. Phase 13 content: don't start until the 3 open items are answered.
4. Commit + push each phase to `origin/main` (github.com/Yash-Awasthi/CTFplayground).

## Status
- Phase 0 ✅ · P1–P7 ✅ · P8–P12 ✅ · P12.5 admin hardening ✅ · **P13 DEFERRED + P14 integration + P15 verification + P16 static replay ✅ (awaiting confirm)**
- Next: Phase 13 production challenge authoring — BLOCKED on story/theme + per-slot technique mapping + base-point confirmation. Do NOT write content without those.

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
- E2E gotcha: stale `astro dev` daemon (reuseExistingServer) can serve OLD code + break after `db:reset:local` wipes local D1 → ALL logins timeout. Fix: kill stale astro dev PID, let Playwright start fresh. (First-test cold-compile flake still separate; warm rerun green. Also `wrangler d1 execute` execSync in specs occasionally hiccups — env flake, not logic; warm rerun green.)
- P8 anti-cheat `src/lib/anti-cheat/`: incorrect+attribution-enabled → O(1) ownership-map lookup (Phase4/5), foreign owner → anti_cheat_events row. Own answer never flags; ordinary no lookup. SERVER-ONLY (participant sees generic incorrect; source never revealed). Wired into processSubmission incorrect path.
- Strike policy (AUTHORITATIVE, build-plan Phase 8 now aligned): 1st foreign=strike no-elim; 2nd on DIFFERENT challenge → status='disqualified'. Idempotency: migration 0002 UNIQUE(event,submitter,challenge) → repeat same-challenge foreign = 1 strike. Only deterministic ownership attribution counts (no heuristics). Eliminated blocked from submit+hint, excluded from public leaderboard.
- P9 first-blood `src/lib/first-blood/`: claimFirstBlood insert onConflictDoNothing UNIQUE(event,challenge) → one winner, idempotent, race-safe. Generic msg "First blood: Q{slot} has been cracked." (no solver). Wired into correct path; solve valid regardless.
- P10 leaderboard `src/lib/leaderboard/`: PERSISTED score DESC → earliest final solve → roll ASC. getAdminLeaderboard (all+strikes, admin-only live). getPublicLeaderboard ONLY RESULTS_PUBLISHED, excludes eliminated, unmasked rolls. `GET /api/leaderboard?event=` 403 until published. Participants never see standings.
- P11 admin `src/lib/admin/`: ADMIN_SECRET env = login credential (constant-time). Mutations require same-origin (CSRF). Routes /api/admin/* (login,logout,overview,leaderboard,extend,freeze,advance,announce,reset-session,bypass) + /admin page. Every mutation audits admin_actions.
- P12.5 admin hardening: OPAQUE admin sessions (migration 0003 `admin_sessions` token_hash unique, created/expires(12h)/revoked). 256-bit CSPRNG raw token in HttpOnly cookie ONLY; D1 stores SHA-256 hash. `createAdminSession/isValidAdminSession/revokeAdminSession`; `isAdmin(cookies, db)`. Logout revokes. Participant session table separate → never cross-authenticates. Admin login IP-hash rate-limited (`admin_login_rate_limit`, HMAC(ip), reuses Phase2 constants; raw IP never stored). Replaced old deterministic HMAC(secret,'admin') cookie.
- Bypass = build-plan GLOBAL per event+challenge (schema no participantId; SWEEP said per-participant — DEVIATION noted). Records challenge_bypasses + bulk-advances participants stuck at slot→slot+1. NO solve/score/first-blood. Session reset revokes session only, preserves all progress.
- P12 SSE `src/lib/sse/` + /api/events/stream (SSE) + /api/events/updates (poll fallback). NO Durable Objects, NO module-global broadcaster — each stream READS D1 + diffs client cursors (fb,ann) → correct cross-isolate, missed events recoverable. Events: state (version changes on transition+extension), firstblood, announcement. NO timer ticks (browser computes countdown, resync on state). Client EventSource+poll fallback in home.astro. Announcements persisted first.
- ADMIN_SECRET added to .dev.vars/.env.example + regen worker types. Client bundle scanned clean (no secret/seed/ownership/private).
- P12.5 opaque admin sessions: migration 0003 admin_sessions (token_hash unique, created/expires 12h/revoked) + admin_login_rate_limit (ip_hash). `src/lib/admin/auth.ts` createAdminSession/isValidAdminSession/revokeAdminSession, `isAdmin(cookies,db)`. Raw 256-bit token cookie-only, SHA-256 hash stored. Admin login IP-hash rate-limited (`admin/rate-limit.ts`). Build-plan Phase 8 spec aligned to two-strike (no longer "no auto-punishment").
- P13 DEFERRED (build-plan revision note added): no production challenges/story/assets. Integration proven on Phase 5 placeholders; slot-1 placeholder = dev Hello-World fixture via real pipeline.
- P16 static replay `src/lib/static-replay/` + `/replay` (prerender=true, ZERO backend/secret at runtime). personalize.ts: investigatorId(localStorage)+PUBLIC REPLAY_SALT+slot→SHA256 (never EVENT_SECRET/seeds). verify.ts client-side (reuses normalizeAnswer, non-secret by design; live validation untouched). manifest.ts→prerendered /replay/challenges.json (public metadata only). leaderboard-export.ts + scripts/export-leaderboard.mjs→public/replay/leaderboard.json (final data, eliminated excluded, unmasked rolls, deterministic). scrub.ts + scripts/scrub-static-replay.mjs (`pnpm replay:scrub`) fails on prohibited data; unmasked rolls allowed.
- Cold-start Playwright flake FIXED: tests/e2e/global-setup.ts warms routes before timed tests; playwright.config retries:1 + timeouts. Cold run green (1 flaky→retry-absorbed).
- pnpm scripts: replay:export, replay:scrub. Zero-cost: no DO, no paid svc; static replay = plain prerendered assets.

## Local dev / test
- `pnpm db:reset:local` (wipe+migrate+seed) → dev event slug `case-files-dev-2026`, state `READY`, rolls 25115000–25115115.
- `pnpm test` (vitest, in-memory better-sqlite3) · `pnpm build` · `pnpm test:e2e` (Playwright; needs `pnpm dev` running — it daemonizes, `astro dev stop` to kill).
- UI uses native form POST (no client-JS dependency); login/logout APIs also accept JSON.
