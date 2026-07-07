# CTF Platform — Phased Build Spec

Scoring model (locked): `score = base_points × time_factor × hint_factor`

- `time_factor = max(0.5, 1 - (elapsed_since_event_start / event_duration) × 0.5)` — linear decay, floor 50%.
- `hint_factor = 0.5` if any hint used on that challenge, else `1.0`. 2 hints max/challenge, either one used = 50%.
- No separate tie-breaker needed — score is continuous, ties are near-impossible. If exact tie occurs: earliest final-solve timestamp wins.
- Base points by tier (proposed, adjust before Phase 13):
  - Q1–Q10 (easy): 100
  - Q11–Q20 (medium): 200
  - Q21–Q29 (hard): 300
  - Q30 (capstone): 500

**Score precision (locked, decided before Phase 6):** the formula is speed-weighted by design — faster players get both earlier access to higher-value challenges *and* better time factors; this double incentive is intentional and the formula is not modified. To avoid floating-point drift in D1/SQLite, all stored scores are **integers in milli-points** (1 point = 1000 units). `final_score` is computed once as `round(base_points × time_factor × hint_factor × 1000)` — a single rounding applied at the end — where `time_factor` uses integer `elapsed_seconds`/`duration_seconds` inputs. Participant totals are integer sums of `solves.final_score` (milli-points); the UI divides by 1000 for display. No intermediate score is ever persisted as a float.

Each phase below is a self-contained prompt — paste into Claude Code/Cursor one at a time, in order. Don't start Phase N+1 until Phase N's acceptance criteria pass.

> **Revision note (post-Phase-0 review):** Phase 1 now creates all 12 tables (incl. `admin_actions`, `announcements`, `challenge_bypasses`) and is multi-event from the start (every event-scoped row keys on `event_id`; internal surrogate IDs are FK targets; roll number is login identity only). Phases 4, 8, 14, 16 acceptance/architecture corrected below.

---

## Phase 0 — Scaffold

**Goal:** repo skeleton, tooling, CI-less local dev loop.

- `pnpm create astro@latest` with TS strict, add Tailwind, React integration.
- Add Cloudflare adapter (`@astrojs/cloudflare`), `wrangler.toml`.
- Install: drizzle-orm, drizzle-kit, zod, vitest, @playwright/test.
- Folder structure exactly as in section 19/20 of the master plan (`src/lib/{auth,anti-cheat,challenges,crypto,db,event,scoring,validation}`, `challenges/01..30-final/`).
- `.env.example` with `EVENT_SECRET`, D1/R2 binding names.
- **Acceptance:** `pnpm dev` runs, empty Astro page loads, `wrangler d1 create` documented in README.

---

## Phase 1 — Database schema

**Goal:** Drizzle schema + one migration for all **12 initial tables**, multi-event architecture, DB-enforced invariants, and an **event-scoped** participant seed.

### Identity & multi-event model
- Every event-specific row is scoped to `event_id`. A roll number identifies a participant **within an event**, never globally. Never assume a roll number globally identifies one participant forever.
- Stable **internal surrogate IDs** are the primary keys and foreign-key targets everywhere. Roll number stays the participant-facing login identity only.
- `participants` uses surrogate `id` PK + `UNIQUE(event_id, roll_number)`.

### Tables (all 12 — do NOT defer any)
`events`, `participants`, `sessions`, `challenges`, `submissions`, `solves`, `hint_usage`, `anti_cheat_events`, `first_bloods`, `admin_actions`, `announcements`, `challenge_bypasses`.
`admin_actions` is created now (not deferred to Phase 11). `announcements` and `challenge_bypasses` are first-class persistent state, not mere audit events.

### Columns (essentials)
- **events**: `id` PK, `name`, `slug` UNIQUE, `state` (enum §23: DRAFT→READY→LIVE→FROZEN→REVIEW→RESULTS_PUBLISHED→ARCHIVED), `started_at`, `duration_seconds`, `secret_version` (personalization-secret **version reference** — the real `EVENT_SECRET` is NEVER stored in DB; live secret comes from the runtime env; frozen once the event begins), `created_at`.
- **participants**: `id` PK, `event_id`→events, `roll_number`, `current_challenge`, `score` (int milli-points), `status`, `created_at`, `last_active_at`. `UNIQUE(event_id, roll_number)`.
- **sessions**: `id` PK, `event_id`, `participant_id`→participants, `token_hash`, `created_at`, `expires_at`, `revoked_at`. (Single active session enforced in Phase 2.)
- **challenges**: `id` PK, `event_id`, `slot` (1..30), `tier`, `base_points`, `attribution_enabled` (bool), `prerequisites`, `created_at`. `UNIQUE(event_id, slot)`.
- **submissions**: `id` PK, `event_id`, `participant_id`, `challenge_id`, `submitted_answer`, `is_correct`, `created_at`. (Every attempt logged, correct or not.)
- **solves**: `id` PK, `event_id`, `participant_id`, `challenge_id`, `solved_at`, `time_factor`, `hint_factor`, `final_score` (int milli-points). `UNIQUE(event_id, participant_id, challenge_id)`.
- **hint_usage**: `id` PK, `event_id`, `participant_id`, `challenge_id`, `hint_number` (1|2), `used_at`. `UNIQUE(event_id, participant_id, challenge_id, hint_number)`.
- **anti_cheat_events**: `id` PK, `event_id`, `submitter_participant_id`, `challenge_id`, `matched_participant_id`, `submitted_answer`, `created_at`.
- **first_bloods**: `id` PK, `event_id`, `challenge_id`, `participant_id`, `claimed_at`. `UNIQUE(event_id, challenge_id)`.
- **admin_actions**: `id` PK, `event_id` (nullable → global), `action_type`, `payload` (json text), `actor`, `created_at`. (Audit row per admin action.)
- **announcements**: `id` PK, `event_id`, `message`, `created_at`.
- **challenge_bypasses**: `id` PK, `event_id`, `challenge_id`, `reason`, `actor`, `created_at`. (Global bypass for one challenge.)

### Constraints (DB-enforced, not app-only)
- `UNIQUE(event_id, roll_number)` — participants.
- `UNIQUE(event_id, participant_id, challenge_id)` — solves.
- `UNIQUE(event_id, participant_id, challenge_id, hint_number)` — hint_usage.
- `UNIQUE(event_id, challenge_id)` — first_bloods.
- FKs from every event-scoped table → `events.id`, and → `participants.id`/`challenges.id` where applicable.
- **Deletion behavior:** `ON DELETE CASCADE` from events → all child rows (dropping an event cleans up its data); participant deletion cascades to its sessions/submissions/solves/hint_usage. Requires `PRAGMA foreign_keys=ON` (D1 enforces per-statement; ensure enabled in tests).

### Indexes (justified by planned queries — no blind indexing)
- participants: `UNIQUE(event_id, roll_number)` doubles as the login lookup index.
- sessions: `index(participant_id)` + `index(event_id)` → active-session resolution.
- submissions: `index(event_id, participant_id, challenge_id)` → per-challenge attempt history.
- solves: `index(event_id, participant_id)` (participant totals) + `index(event_id, challenge_id)` (per-challenge solve counts / leaderboard).
- anti_cheat_events: `index(event_id, submitter_participant_id)`.
- announcements: `index(event_id, created_at)`.
- admin_actions: `index(event_id, created_at)`.

### Types / representation (SQLite/D1)
- Timestamps: integer Unix epoch **seconds**, consistent across all tables (`integer({ mode: 'timestamp' })`).
- Scores: integer milli-points (see Score precision note).
- IDs: integer autoincrement surrogate PKs, consistent everywhere.
- Enums: text columns with a fixed allowed set.

### Seed (event-scoped)
- CLI conceptually `pnpm db:seed --event <event-id>` (or create-and-seed in one shot). Flow: **create dev event → obtain event_id → insert roll numbers 25115000–25115115 into that event.** Roster is a parameter so future events can use different rosters. No global roll-number insertion.

**Acceptance:** `drizzle-kit generate` + local `wrangler d1 migrations apply` succeed **from a clean DB**; dev event created; **exactly 116** participants seeded into it (first `25115000`, last `25115115`); duplicate `(event_id, roll_number)` rejected; same roll number allowed in two different events; duplicate solve / hint(hint_number) / first-blood rejected by DB constraint; FK relationships behave; `pnpm build` + `pnpm test` green.

---

## Phase 2 — Auth & sessions

**Goal:** roll-number login, single active session, rate limiting.

- Login: username = password = roll number, validate range 25115000–25115115.
- On login: invalidate any existing session for that roll number, create new session row, set httpOnly signed cookie.
- Rate limit login attempts per roll number + per IP (in-memory or D1 counter with sliding window).
- Middleware: every protected route resolves session → participant, redirects to login if invalid.
- **Acceptance:** Vitest covers: valid login, invalid roll number rejected, second login invalidates first session, rate limit trips after N attempts.

---

## Phase 3 — Event state machine & timer

**Goal:** server-authoritative event clock, admin-controlled state transitions.

- Implement state machine: `DRAFT → READY → LIVE → FROZEN → REVIEW → RESULTS_PUBLISHED → ARCHIVED`.
- Admin action: start event (sets `started_at`), extend timer (adds seconds), force-freeze.
- SSE endpoint broadcasting: remaining time, event state changes, announcements, first-blood events.
- Client timer component: reads SSE, falls back to poll if SSE drops, always defers to server value (never trusts local countdown drift).
- **Acceptance:** admin can start/extend/freeze; client timer reflects server truth even after tab reload.

---

## Phase 4 — Personalization/seed engine

**Goal:** deterministic per-participant, per-challenge seeds.

- `lib/crypto/seed.ts`: `participant_seed = HMAC-SHA256(EVENT_SECRET, roll_number)`, `challenge_seed = HMAC-SHA256(participant_seed, challenge_id)`.
- Deterministic PRNG from seed (e.g. seeded xorshift/mulberry32 fed by seed bytes) for generating names/numbers/filenames.
- Helper functions: `pickFromList(seed, list)`, `randomInt(seed, min, max)`, `shuffle(seed, arr)`.
- Seed derivation binds the event: `participant_seed = HMAC-SHA256(EVENT_SECRET_for(secret_version), event_id || roll_number)`, `challenge_seed = HMAC-SHA256(participant_seed, challenge_id)`.
- **Acceptance:** Vitest —
  - same event + roll number + challenge ID always produces identical output;
  - different challenge IDs produce different challenge seeds;
  - different roll numbers produce different participant seeds;
  - different event secrets produce different seeds;
  - deterministic output survives process restarts;
  - every challenge marked **attribution-enabled** guarantees unique normalized answers across all 116 participants.
  - *Not* required: global uniqueness of every generated challenge value — only attribution-enabled answers must be unique.

---

## Phase 5 — Challenge module interface + validation

**Goal:** the contract every challenge implements, and the engine that runs it.

- Define TS interface: `{ id, tier, basePoints, prerequisites, generate(seed): ChallengeContent, validate(seed, submittedAnswer): boolean, hints: [string, string] }`.
- Answer validation: default normalize (trim, optional case-fold), per-challenge override allowed.
- Progression check: reject access to challenge N if N-1 not in `solves` for that participant.
- Submission endpoint: validates, records in `submissions` regardless of outcome, on success writes `solves` (unscored — scoring is Phase 6).
- **Acceptance:** Vitest covers sequential gating (can't jump ahead), correct/incorrect answer paths, submission logged either way.

---

## Phase 6 — Scoring engine

**Goal:** implement the locked formula.

- `lib/scoring/calculate.ts`: given challenge base_points, event `started_at`/`duration_seconds`, solve timestamp, hint usage → `final_score`.
- Wire into submission endpoint: on valid solve, compute and persist `time_factor`, `hint_factor`, `final_score`.
- Participant total score = sum of `solves.final_score`.
- **Acceptance:** Vitest — score at t=0 with no hint = base_points; score at t=event_duration = 0.5×base_points; hint used halves whatever time-decayed value was; floor never below 0.25×base (0.5 time floor × 0.5 hint floor).

---

## Phase 7 — Hint system

**Goal:** 2 hints/challenge, first-use locks in `hint_factor = 0.5` for that challenge permanently.

- `hint_usage` table: participant, challenge, hint_number, timestamp.
- Using hint 1 or hint 2 (either) sets a `hint_used` flag on that participant/challenge — factor doesn't stack further on second hint.
- UI: hint reveal is one-way, confirm dialog before reveal ("this halves your score for this challenge").
- **Acceptance:** using hint 1 then hint 2 still only applies 0.5× once; hint content is directional (per section 11), not the answer.

---

## Phase 8 — Anti-cheat attribution

**Goal:** detect copied personalized answers — **via an answer-ownership index, not brute-force regeneration.**

- Do **not** regenerate and compare all other 115 participants' answers on every wrong submission.
- For **attribution-enabled** challenges, build an ownership index `normalized_answer → participant_id` (scoped to `event_id`, `challenge_id`). It may be generated deterministically, cached, or materialized when the event enters `READY`.
- Submission flow: normalize answer → compare to the submitter's own expected answer. If correct → process solve. If wrong → look up the ownership index: if a **foreign** participant owns that normalized answer → create an `anti_cheat_events` row (`submitter_participant_id`, `challenge_id`, `matched_participant_id`, `submitted_answer`); otherwise a normal incorrect submission.
- Aggregate flag count per participant; expose in admin dashboard; **no auto-punishment.**
- **Acceptance:** Vitest — submitting another (simulated) participant's valid answer creates a flag with correct `matched_participant_id`; submitting your own correct answer never flags; a random wrong string never flags; lookup is O(1) index hit, not an N-participant scan.

---

## Phase 9 — First blood

**Goal:** atomic first-solver detection per challenge.

- On solve write, use a D1 conditional insert / unique constraint on `first_bloods(challenge_id)` to atomically claim first blood — race-safe under concurrent solves.
- On claim, push SSE announcement (challenge title only, no participant identity).
- **Acceptance:** simulate concurrent solves (Playwright or direct concurrent requests) — exactly one first-blood claim per challenge, no duplicates.

---

## Phase 10 — Leaderboard

**Goal:** admin-only live view, public post-event view.

- Admin endpoint: full standings anytime, sortable, includes anti-cheat flags.
- Public endpoint: only serves data when `events.state = RESULTS_PUBLISHED`; full roll numbers, score, solve list, timing.
- **Acceptance:** public leaderboard route 403s/empty until state flips; admin route always live.

---

## Phase 11 — Admin dashboard

**Goal:** operational control surface (section 15).

- Views: event status + timer controls, active sessions, per-challenge solve counts, hint usage stats, recent submissions feed, anti-cheat flag review, first-blood log, system health (D1/R2 reachability).
- Actions: extend timer, send announcement (writes `announcements`), reset a stuck session, global bypass for one challenge (writes `challenge_bypasses`). Every action also writes an `admin_actions` audit row. All three tables already exist from Phase 1 — do not create them here.
- **Acceptance:** every admin action writes an `admin_actions` audit row (plus its domain row where applicable); dashboard reflects DB state within one SSE tick.

---

## Phase 12 — Participant UI

**Goal:** the actual player-facing experience.

- Login page, case-file style challenge view (title, story fragment, asset links, answer box, hint buttons, points shown), progress tracker (Q1..Q30, locked/unlocked/solved states, no jump links for locked ones).
- Countdown timer component wired to Phase 3 SSE.
- Toast/notification for first-blood announcements and admin messages.
- **Acceptance:** Playwright — full journey for a sample roll number from login through Q3 solve, refresh mid-way confirms state restore.

---

## Phase 13 — Challenge authoring (content)

**Goal:** write all 30 challenges using the Phase 5 interface.

- One challenge at a time. For each: `challenge.ts` (metadata/prereqs/points), `generator.ts` (personalized content via Phase 4 seed helpers), `validator.ts`, `hints.ts`, `assets/` if needed.
- Confirm story/theme details with me before writing narrative copy — not yet locked (only tone is: agency/cybercrime/detective, per master plan section 7).
- Techniques to rotate across the 30 (per section 6): HTML/source, hidden path, query param, cookie/localStorage, robots.txt, login flaw, beginner SQLi, filename clue, image clue, metadata, archive/strings, small log/PCAP, final synthesis.
- **Acceptance:** each challenge solvable end-to-end with correct seed, unsolvable without it (spot-check 3 random roll numbers per challenge).

---

## Phase 14 — Testing pass

**Goal:** full-system confidence before go-live.

- **Vitest — exhaustive deterministic layer.** Run **all 116 participants × 30 challenges = 3,480 combinations** through generation, validation, personalization invariants, attribution-answer uniqueness, scoring math, hint penalties, anti-cheat attribution, and progression logic. This is small enough for complete coverage — do it.
- **Playwright — representative sample only.** Full browser journeys for a small sample of roll numbers: login, session replacement, progression, hints, submissions, Q30 completion, leaderboard behavior. Do **not** run 116 full browser journeys unless later needed.
- Load check: confirm D1/R2 usage stays inside Cloudflare free tier at expected 40-concurrent-user load.
- **Acceptance:** all 3,480 combinations pass the deterministic layer; sampled Playwright journeys green; no console errors in a live-mode dry run.

---

## Phase 15 — Deployment & runbook

**Goal:** go-live readiness (section 28).

- `wrangler deploy`, bind D1/R2 in production, set production `EVENT_SECRET` (frozen, never logged).
- Pre-event checklist: all 30 challenges verified, personalization collision-checked, login + timer tested, admin dashboard confirmed, leaderboard export confirmed, static archive path confirmed.
- **Acceptance:** staging run-through with 2–3 real testers on real roll numbers.

---

## Phase 16 — Static archive/replay mode

**Goal:** post-event public replay (section 25).

- Separate static build: no auth, no backend, no live leaderboard.
- **Personalized replay (not a single fixed demo seed):** on first visit the client generates a random `investigator_id` and stores it in localStorage. Challenge personalization is derived deterministically from `investigator_id` + a **static replay version/salt** + `challenge_id` — so a returning browser sees the same variants, and different visitors see different ones.
- **Reset Investigation** button: clears replay progress, generates a **new** `investigator_id`, restarts the investigation.
- Answer checking is client-side (acceptable — non-competitive archival mode).
- Content pulled from a sanitized export of the 30 challenges. **Never** use production event secrets or real participant seeds in the static build; the replay salt is public and unrelated to `EVENT_SECRET`.
- **Acceptance:** static build has zero calls to production API/D1/R2; personalization is stable per `investigator_id` and changes on reset; deployable as plain static hosting.

---

## Phase 17 — Post-event wrap

**Goal:** review → publish → archive (section 28 "after").

- Freeze submissions (state → FROZEN), admin reviews `anti_cheat_events`, finalizes any manual standing adjustments (logged), flips state → RESULTS_PUBLISHED.
- Export CSVs (participants, scores, solves, timing) — private record, not committed to repo.
- Sanitize and push static archive (Phase 16 output) to public hosting.
- **Acceptance:** public leaderboard live, static archive live, no secrets in either.

---

## Open items before Phase 13 content-writing starts

1. Story/theme specifics (agency name, case name, final-mystery synthesis) — not yet defined.
2. Exact per-challenge technique assignment (which of the 30 slots gets SQLi, which gets PCAP, etc.) — needs a mapping table.
3. Confirm base-point tier numbers above, or adjust.
