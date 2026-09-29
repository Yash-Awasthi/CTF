# Case Files (CTF) — absorption plan

Written 2026-09-12. Companion to the Astro + Cloudflare Workers app in this directory.

## What this document is

`C:\Users\yasha\PROJECTS\inspiration\CTF` holds 189 cloned upstream repositories —
CTF platforms (CTFd, rCTF, GZCTF, picoCTF, fbCTF, kCTF, ForcAD, rCDS, Mellivora), Cloudflare
Workers + D1 + Drizzle starter kits, state-machine libraries, seeded PRNGs, SSE libraries,
leaderboard implementations, plagiarism and flag-sharing detectors, puzzle-hunt and quiz
platforms, OSINT collections, and scoring-algorithm references.

This document records every defect found while reading the app's own source (Part 1), maps
the corpus to the app (Part 2), and sets out a plan to close the gap (Part 3).

The corpus has already been mined once. `src/lib/` contains modules whose names map
one-to-one onto corpus repositories — `rcds_backend.ts` (redpwn/rCDS),
`pnku_state_machine.ts` (PKUPC/pnku-website), `ctf_web_archive.ts` (ArchiveBox /
ReplayWeb.page), `ctfdump_extractor.ts` (CTFDump), `plagiarism_detector.ts` (copydetect /
MOSS), `prng_engine.ts` + `seeded_random.ts` + `seed_spring.ts` (seedrandom / prando /
pure-rand / seedspring), `entropy_collector.ts`, `state_machine_xstate.ts` +
`statechart_engine.ts` (xstate / jssm), `hint_marketplace.ts`, `tournament_ranking.ts`,
`quiz_engine.ts`, `puzzle_engine.ts`, `puzzlehunt_platform.ts`, `live_quiz_engine.ts`,
`adaptive_difficulty.ts`, `dynamic_scoring.ts`, `time_decay_scoring.ts`,
`attack_defense_scoring.ts`, `ctf_edge_deployment.ts`, and more.

The problem is that this absorption was additive. Nothing was removed or reconciled, so the
app now runs several parallel implementations of the same concept, and at least two
complete authentication systems. Part 1 is mostly about the consequences.

**The app's own tests are the authority on what is real.** Anything in `src/lib/` that has no
importer and no test is a draft, not a feature.

---

## Part 1 — Defects in the current app

Severity: **critical** is a live security or integrity hole; **high** breaks a feature or a
security boundary; **medium** is correctness or maintainability with a real user-visible
edge; **low** is tidiness with a real cost.

### 1. `POST /api/submit-flag` awards points for hardcoded flags — **critical**

`src/pages/api/submit-flag.ts` is a mock. It never touches D1. Lines 91-101 build a table of
fake flags:

```js
const CHALLENGE_FLAGS: Record<number, {...}> = {};
for (let i = 1; i <= 30; i++) {
  CHALLENGE_FLAGS[i] = { flag: `case_{${String(i).padStart(2, "0")}}_flag`, ... };
}
```

Line 154 compares the submitted flag against that literal string, and on a match lines
166-188 compute a score, emit a solve event into an in-memory scoreboard, and return
`{ correct: true, points_earned: points }`.

Anyone can therefore POST `{"challenge_id": 1, "submitted_flag": "case_{01}_flag"}` and be
told they solved challenge 1. The flag pattern is guessable from the source, and the file
header comment says so out loud: *"All logic client-side for now — wire to D1 when backend
is ready."*

Worse, it is advertised. `src/pages/api-docs.astro:28` lists `/api/submit-flag` as a public
endpoint. The real flow is `POST /api/submit` → `src/lib/submission/submit.ts`, which is
D1-backed, idempotent, and correct. Nothing in the app calls `submit-flag`; its only
references are its own file, the API docs page, and its doc comment.

Three further problems inside the same file:

- **Rate limiting is trivial to bypass.** Line 121 keys the limiter on
  `request.headers.get("x-forwarded-for")`, which the client controls. The rest of the app
  uses `CF-Connecting-IP`, which Cloudflare sets and a client cannot spoof
  (`src/lib/auth/rate-limit.ts:21` hashes it for exactly this reason). A limiter keyed on a
  spoofable header is not a limiter.
- **The limiter is per-isolate.** `rateLimits` is a module-level `Map` (line 18). On
  Workers each isolate has its own copy, so the effective limit is `5 × active isolates`
  per minute and resets on cold start.
- **It does not typecheck.** Line 175 reads `challenge.name`, but the object built at
  line 96 has only `flag`, `basePoints` and `tier`. `challenge.name` is not a property of
  that type.

Fix: delete `src/pages/api/submit-flag.ts` and remove its entry from
`src/pages/api-docs.astro`. The real endpoint exists and is tested.

### 2. A second, client-side authentication system lives in `src/lib/auth.ts` — **critical**

`src/lib/auth.ts` (251 lines) is a complete browser-side auth system:

- `hashPassword` / `verifyPassword` using PBKDF2-SHA256 (lines 33-74).
- `register` and `login` writing whole user records — **including `passwordHash`** — into
  `localStorage` under `case71c_users` (lines 78-197).
- Sessions in `localStorage` under `case71c_session`, with a token from
  `crypto.randomUUID()` (lines 188-196).
- `addPoints` mutating the local score, and `getLeaderboard` computed from local data
  (lines 229-250).

It is not dead. `src/pages/login.astro:240` imports it at runtime:

```js
import('/src/lib/auth.ts').then(({ getCurrentSession }) => {
  if (getCurrentSession()) window.location.href = '/challenges';
});
```

The header comment states the intent: *"All validation client-side — wire to D1 API when
backend is ready."* The D1 backend was built. `src/lib/auth/` is that backend — a real
session system with 256-bit CSPRNG opaque tokens, SHA-256-hashed at rest, HttpOnly
cookies, one-active-session enforcement, and a DB partial-unique index backstop
(`src/lib/auth/sessions.ts:15-42`, `src/lib/auth/session-token.ts`).

The two systems share a module specifier base, which is the dangerous part. `@/lib/auth`
resolves to the **file** `lib/auth.ts` before the **directory** `lib/auth/index.ts` under
standard TypeScript and bundler resolution. So an import written as `@/lib/auth` silently
picks up the localStorage mock instead of the real server session code. A grep shows no
current importer of the bare specifier, but the trap is armed: the next person to write
`import { ... } from '@/lib/auth'` gets the fake system and no error.

`verifyPassword` also compares hashes with `===` (line 73), which is not constant-time.

Fix: delete `src/lib/auth.ts`, and change `src/pages/login.astro:240` to call the real
session endpoint (`GET /api/session`). Then confirm `@/lib/auth` resolves to the directory.

### 3. Client-side team state in `src/lib/teams.ts` — **high**

`src/lib/teams.ts` (13.6 KB) keeps teams, members and solves in `localStorage` under
`case71c_teams`, `case71c_team_members` and `case71c_team_solves` (lines 25-27). The README
advertises team mode: "Create teams of 2-5 investigators", "Team scoring: best score per
challenge counts once across team", "Captain actions: promote, remove members, disband".

Team membership and team scoring decided in the browser are not team membership or team
scoring. Every participant can edit their own copy of the data, and nothing the server
enforces depends on it. Either the team tables exist in `src/lib/db/schema.ts` and this
module needs to be rewritten against them, or team mode is a UI shell and the README
should say so.

The same pattern appears in `src/lib/challenge_auth.ts` and `src/pages/api/register.ts`,
each of which defines its own `validatePassword` (lines 73 and 29 respectively) that
disagrees with the policy in the deleted `auth.ts` and with each other.

### 4. `guardAdmin` locks out admins unless Cloudflare Access is configured — **high**

`src/lib/admin/guard.ts:57-63`:

```js
const accessIdentity = getAccessIdentity(request);
if (!isAccessAdmin(request)) {
  return adminJson({ error: 'access_not_authorized', ... }, 403);
}
```

`isAccessAdmin` (`src/lib/auth/access.ts:104-118`) returns `false` whenever
`ACCESS_ADMIN_EMAILS` is unset — deny-by-default, which is the right default for that
function in isolation. But `guardAdmin` calls it unconditionally, so with no Access
identity configured, **every admin route returns 403** even for a correctly authenticated
admin.

`src/lib/auth/access.ts:128-151` already provides `guardAdminWithAccess`, which treats
Access as optional: it enforces the cookie layer always, and the Access layer only when
`ACCESS_ADMIN_EMAILS` is present. `guard.ts` does not use it. Either the guard should call
that function, or Access should be a hard requirement and the docs should say the app
cannot be administered without it.

Note also line 56 computes `accessIdentity` and line 57 calls `isAccessAdmin`, which
internally calls `getAccessIdentity` again — the comment on line 55 says "Call
getAccessIdentity once and reuse the result", and the code then does not.

### 5. `src/lib/security/headers.ts` is dead, so no response gets a CSP — **high**

`security/headers.ts` (103 lines) defines the app's Content-Security-Policy, HSTS,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy, and three
helpers to apply them. A repository-wide grep for `security/headers`, `getSecurityHeaders`
and `withSecurityHeaders` finds **no importer** outside the file itself.

`src/middleware/index.ts` — the one place that could apply them to every response — does
not. So the CSP described in the file, including `default-src 'self'`, `frame-ancestors
'none'` and `form-action 'self'`, is never sent. The admin-shape routes do set a few
headers inline (`src/lib/admin/guard.ts:15-27`), which is how the gap has gone unnoticed.

Fix: apply `withSecurityHeaders` in `src/middleware/index.ts` so the policy applies to
every response, then delete the duplicated inline header blocks.

One note if it is wired: `headers.ts:63` sets
`connect-src 'self' https://*.pages.dev wss://*.pages.dev`, which permits connections to
*any* `pages.dev` site, not just this project's. Narrow it to the specific host.

### 6. The admin password compare leaks its length — **medium**

`src/lib/admin/auth.ts:27-32`:

```js
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  ...
}
```

The early return makes the comparison time proportional to the length of the matching
prefix only when lengths are equal — so an attacker learns `ADMIN_SECRET`'s length without
submitting a full guess, and can then attack only that length.

`src/lib/auth/credentials.ts:7-17` does this correctly, folding the length difference into
the accumulator so the loop always runs `max(len(a), len(b))` times. Two implementations of
the same primitive, one strictly weaker. `admin/auth.ts` should import the other.

### 7. Failed-login counters lose updates under concurrency — **medium**

`src/lib/auth/rate-limit.ts:77-116` (`recordFailure`) and `src/lib/admin/rate-limit.ts:38-57`
(`recordAdminFailure`) both read the row, then write `failureCount + 1` back:

```js
const row = await db.select()...get();
...
await db.update(loginRateLimit).set({ failureCount: row.failureCount + 1 })...;
```

Two concurrent failures read the same count and both write the same value, so *n*
simultaneous attempts can be recorded as one. An attacker distributing guesses across
connections undercounts their own failures and can exceed the intended
`RATE_LIMIT_MAX_FAILURES`. The window reset has the same shape.

Fix: do it in one statement — `SET failureCount = failureCount + 1` with the window reset
expressed as a `CASE`, exactly as `src/lib/auth/sessions.ts` does its revocation, and as
the foodref worker does its rate limiting.

### 8. Every request pays for auth, including static assets — **medium**

`src/middleware/index.ts:11-18` runs on every request, and on each one calls
`createDb(getEnv().DB)` and `getAuthenticatedParticipant(...)`. That resolver performs up to
three D1 queries (`sessions`, `participants`, `events`) via
`src/lib/auth/sessions.ts:61-92`. Astro middleware runs for static assets too, so a page
with forty images issues forty rounds of session lookups that nobody reads. On Workers,
where every D1 query is billable and latency-visible, this is the app's largest avoidable
cost.

Fix: skip the DB work for non-HTML requests and paths that cannot need auth
(`/api/health`, `/_astro/*`, static extensions), or resolve auth lazily so it runs only
when a route reads `locals.auth`.

### 9. `isSameOrigin` passes when both Origin and Referer are absent — **medium**

`src/lib/admin/auth.ts:109-126` returns `true` when there is no `Origin` header and no
`Referer` header:

```js
if (!origin) {
  const referer = request.headers.get('referer');
  if (!referer) return true; // non-browser/native call; cookie+HttpOnly still required
}
```

The comment states the assumption: a non-browser caller still needs the HttpOnly cookie.
That holds for a caller who does not have the cookie. It does not hold for a same-site XSS
or any script running on the origin, which can omit both headers and mutate admin state
without triggering the check. The mitigation is real but narrower than the comment implies,
and the failure mode is silent.

### 10. One page file is 174 KB — **medium**

`src/pages/[event]/challenge/[slot].astro` is 173,843 bytes — larger than the entire
`src/lib/auth/` directory and roughly 15% of all source in the repository. For contrast the
second-largest file, `src/pages/admin.astro`, is 27 KB.

A file that size cannot be reviewed, cannot be diffed meaningfully, and hides errors that a
compiler would otherwise separate. It should be decomposed into the page shell plus the
components it renders; the corpus has dozens of platform front-ends to model this on.

### 11. Duplicate and parallel subsystems — **medium**

The additive absorption left several concepts implemented more than once. Each pair below
is a real maintenance hazard, because a fix applied to one is not applied to the other.

| Concept | Implementations |
|---|---|
| Auth | `src/lib/auth.ts` (client, localStorage) vs `src/lib/auth/` (server, D1) |
| Teams | `src/lib/teams.ts` (client, localStorage) vs team tables in `src/lib/db/schema.ts` |
| Leaderboard | `src/lib/leaderboard.ts` (11.8 KB) vs `src/lib/leaderboard/` (directory) |
| Scoring | `src/lib/scoring/` (directory) vs `scoring_system.ts`, `scoring_algorithms.ts`, `dynamic_scoring.ts`, `time_decay_scoring.ts`, `attack_defense_scoring.ts`, `adaptive_difficulty.ts`, `ctf_scoreboard.ts`, `scoreboard_engine.ts`, `scoreboard_tracker.ts`, `live_scoreboard.ts`, `leaderboard.ts` — eleven modules |
| Hints | `src/lib/hints/` (directory) vs `hint_system.ts`, `hint_marketplace.ts` |
| State machines | `state_machine_engine.ts`, `state_machine_xstate.ts`, `statechart_engine.ts`, `python_statemachine.ts`, `pnku_state_machine.ts`, `game_state.ts`, `event/state.ts` |
| PRNG | `src/lib/crypto/rng.ts` vs `prng_engine.ts`, `seeded_random.ts`, `seed_spring.ts`, `entropy_collector.ts` |
| Submission | `src/pages/api/submit.ts` vs `src/pages/api/submit-flag.ts` |
| SSE | `src/lib/sse/` (directory) vs `sse_manager.ts`; routes `api/events/stream.ts`, `api/events/updates.ts`, `api/scoreboard-sse.ts` |

The scoring cluster is the clearest case: eleven modules implement point calculation.
`src/pages/api/submit-flag.ts:49-67` contains a *twelfth* copy inline. The README describes
one formula (`base_points × time_factor × hint_factor`, floored at
`0.25 × base_points`, integer milli-points) and there is a test suite for it
(`src/lib/__tests__/scoring.test.ts`, 4,156 lines) — so the canonical implementation exists
and the others are drafts.

### 12. Two package managers, two lockfiles — **low**

The repository root contains `package-lock.json`, `pnpm-lock.yaml` **and**
`pnpm-workspace.yaml`, while the README instructs `pnpm install` and CI must pick one.
Two lockfiles drift; when they do, the installed tree depends on which tool ran last.
Delete whichever is not authoritative.

### 13. Dead documentation surface — **low**

`src/pages/api-docs.astro` (7.5 KB) enumerates endpoints, including the mock
`/api/submit-flag` (§1). A hand-maintained endpoint list drifts from the routes that exist.
`src/pages/api/openapi.json.ts` (8 KB) is the better source; the docs page should read from
it rather than restate it.

### 14. The Better Auth route is mounted but cannot run — **high**

`src/pages/api/auth/[...all].ts` forwards every method on `/api/auth/*` to
`getAuth().handler(request)`. That instance is built in `src/lib/auth/better-auth.ts` with

```ts
database: drizzleAdapter(db, {
  provider: 'sqlite',
}),
```

No `schema` mapping is passed. Better Auth's Drizzle adapter resolves its models through
`config.schema || db._.fullSchema` and then indexes by its own model names, and it throws on
a miss (verbatim from `node_modules/@better-auth/drizzle-adapter/dist/index.mjs`):

```js
if (!schemaModel) throw new BetterAuthError(`[# Drizzle Adapter]: The model "${model}" was not found in the schema object. ...`);
```

`createDb` does pass a schema (`src/lib/db/client.ts`: `drizzle(d1, { schema })`), but its keys
are `participants`, `sessions`, `events`, `challenges`, … — there is no `user`, `session`,
`account` or `verification` key, and none of those four tables appear in `migrations/` either.
So the first operation on any `/api/auth/*` route throws, and the route answers 500.

Two things make this worth stating plainly rather than leaving to be rediscovered:

- **It is a live HTTP surface that fails.** An unauthenticated caller reaching `/api/auth/sign-up/email`
  gets a 500 with a stack trace in the logs, not a 404.
- **Nothing else consumes it.** `getAuthenticatedParticipant` (`src/lib/auth/authenticate.ts`),
  which middleware calls, is the home-grown system. The apparent other references to `getAuth`
  in `src/middleware/index.ts` and `src/lib/hint_marketplace.ts` are substring false positives
  (`getAuthenticatedParticipant`, `getAuthorStats`). No test imports the module.

Per Part 2's disposition table this integration is a *conditional* adopt ("only if the
home-grown session system is ever replaced"), and both files are untracked work in progress. So
the choice — finish it by adding the four tables and the schema mapping, or remove the route
and module — is a product decision, and this plan does not make it. Until it is made, expect a
500 on that path.

### 15. The same module replaced Better Auth's password hashing with an unsalted digest — **high (latent)**

`createAuth` overrode the password KDF:

```ts
password: {
  hash: async (password) => { /* bare SHA-256, hex */ },
  verify: async (data) => computedHash === data.hash,   // non-constant-time
}
```

Unsalted SHA-256 is not a key derivation: it is fast to brute-force, identical for every user
who chooses the same password, and recoverable from a precomputed table as soon as the
database leaks. The `===` compare also leaks the matching length through timing.

This is latent, not live: the adapter in §14 throws before any hash is written, so no row
exists in this format. But it is a landmine for whoever fixes §14 — the option path is real
(`options.emailAndPassword?.password?.hash`, resolved in
`better-auth/dist/context/create-context.mjs`), so the override *is* what Better Auth would
use, and it replaces a production-grade default: Better Auth's own is **scrypt**
(`@better-auth/utils/password`, resolving to `node:crypto scrypt` under the `workerd`
condition this app selects via `nodejs_compat`).

**Fixed.** The hashing moved to `src/lib/auth/password.ts`: PBKDF2-HMAC-SHA256, a random
16-byte salt per password, 100,000 iterations, stored as
`pbkdf2$<iterations>$<salt-hex>$<key-hex>`, compared in constant time through the existing
`constantTimeEqual`. Web Crypto is used because it is the one KDF the Workers runtime exposes
unconditionally — whether Workerd implements `node:crypto` scrypt is a question this audit
could not settle from the repository alone, and the runtime's CPU budget, not the algorithm
list, is the binding constraint on this platform. The iteration count lives inside each hash,
so it can be raised later without invalidating stored rows.

### 16. A fresh install leaves the test suite unrunnable, and it fails quietly — **medium**

npm 12 applies an install-script allowlist. On this machine six packages are blocked:

```
better-sqlite3@12.11.1 (install: prebuild-install || node-gyp rebuild --release)
esbuild@0.28.2, esbuild@0.25.12, esbuild@0.28.1, esbuild@0.18.20 (postinstall)
workerd@1.20260828.1 (postinstall)
```

`better-sqlite3` is the one that matters here: the DB-backed tests construct their schema
through it, so with the native binding absent **92 of 720 tests fail**, every one of them with
`Error: Could not locate the bindings file` rather than anything about the code under test.
The failures look like product defects and are not.

This is an environment/CI defect, not a source defect, and it is invisible in the repository —
which is exactly why it belongs in this document. `npm install-scripts approve better-sqlite3`
(or `pnpm`, the package manager the README names) fixes it. Fetching the prebuilt binary
directly, `npx prebuild-install` inside `node_modules/better-sqlite3`, also works and needs no
compiler. Verified: after that, 720/720 pass.

---

## Part 2 — Corpus inventory and disposition

189 repositories. Legend:

| Mark | Meaning |
|---|---|
| **Adopt** | its capability should become a feature of the app |
| **Reconcile** | the app already has an equivalent; decide which one wins and delete the other |
| **Reference** | study for technique; no code taken |
| **Out of scope** | different problem domain |

### 2.1 CTF platforms

The core comparison set. The app is a bespoke, classroom-oriented platform, so none of
these is a drop-in, but each solves a problem the app will meet.

| Repo | Disposition | Note |
|---|---|---|
| ctfd | Reference | the reference jeopardy platform; plugin model worth studying |
| rctf | Reference | "this version is no longer maintained"; scoring model source of `rcds_backend.ts` |
| gzctf | Reference | ASP.NET platform |
| picoctf | Reference | deprecated version; the per-team instance model is instructive |
| fbctf | Reference | Facebook's; King-of-the-Hill mode |
| kctf | Reference | Kubernetes-based; infrastructure, not application |
| challenger / chall-manager | Reference | on-demand challenge instances |
| forcad, checksystem, ctf-gameserver, scorebot | Reference | attack–defence platforms |
| rcds | **Reconcile** | `src/lib/rcds_backend.ts` (9.2 KB) was ported from it; confirm it is wired or delete |
| cdsctf, xctf, ctfzone, cardinal, mellivora, tinyctf-platform, nightshade, noCTF, nxctf, dotflag, flagfish, flagforge, ctfd deprecated forks, rootthebox, rtb-ctf-framework, canhackme, solveme, ti0sctf-oj, tp0toj, hack-the-arch, henhouse, djangoctf, coldcore, ctf-scoreboard, gryphonctf-scoreboard, ctf_platform, ctfv, orbital-ctf, pwnshop, playctf, thecyberhub, edurange_cloud, pathwar, pail, ret2shell, cyberbattleground, klodd, kube-ctf, paradigm-ctf-infrastructure, dojo, multi-juicer, bypass | Reference | platform implementations across many stacks |
| ctf-scoring-simulator, scoring-playground | **Adopt** | simulate and validate scoring before an event runs |
| tinyctf, minictf, mkctf, ctfcli, ctf-collab, ctfd2pages | Reference | tooling around events |
| ctfd-portable-challenges-plugin, ctf-re, paradigm infra | Reference | challenge packaging |
| juice-shop-ctf, pnku-website, puzzlehunt_server, puzzlespring, puzzup, cardboard, mainpuzzleserver, gph-site, infinity, myus | Reference | puzzle-hunt specific platforms |
| a1ctf, imaginaryctf, librectf | Reference | competition platforms with unusual scoring or deployment models |
| attack-and-defense-ctf-platform, beast, haaukins | Reference | attack–defence and hosted-lab platforms; infrastructure heavy |
| pwnthemall, yatb | Reference | challenge-serving platforms |
| Jeopardy-Platform, ctfproxy, ctfscoreboard | Reference | platform, reverse proxy and scoreboard, studied separately |

### 2.2 Challenge-type and scoring plugins

The corpus is unusually rich here, and this is where the app's own differentiator
(per-player personalized content) has a direct lineage.

| Repo | Disposition | Note |
|---|---|---|
| ctfd-dynamic-flag, dynamic-flag-ctfd-framework, ctfd-individual-flags-plugin, ctfd-personal_challenge-plugin, ctfd_unique_challenges | **Reconcile** | per-user flags — the app's HMAC-derived per-player answers are the same idea; confirm one implementation |
| DynamicValueChallenge, ctfd-dynamic-challenges-mod | **Reconcile** | dynamic point decay; the app has `dynamic_scoring.ts` and `adaptive_difficulty.ts` |
| ctfd-time-decay-plugin | **Reconcile** | against `time_decay_scoring.ts` and the README's documented formula |
| ctfd_first_blood | **Reconcile** | against `src/lib/first-blood/` |
| decay | Reference | three popularity/decay algorithms |
| ctfd-sharewatch, ctfd-flag-sharing, ctfd-redherring | **Adopt** | read-only flag-sharing detection for admins — the app detects copying but gives admins no view of it |
| copydetect, mossum, mosster, plagiarism-basic, plagiarism-detection | **Reconcile** | the app has `plagiarism_detector.ts`; pick one algorithm and delete the rest |
| content-seal | Reference | Meta's content-sealing research |

### 2.3 Cloudflare, D1 and Drizzle

| Repo | Disposition | Note |
|---|---|---|
| drizzle-orm | Dependency | already the app's ORM |
| workers-sdk, templates, python-workers-examples | Reference | the platform's own examples |
| better-auth-cloudflare | **Adopt** | D1-native auth; directly relevant to §2's two-auth-systems problem |
| hono-rate-limiter, express-brute | **Adopt** | algorithmic rate limiters; the app's counters lose updates (§7) |
| d1-drizzle-example, d1-drizzle-remix-example, cloudflare-d1-drizzle-honox-starter, workers-d1-hono-drizzle-template, nextjs-d1-drizzle-cloudflare-pages | Reference | D1 + Drizzle wiring patterns |
| cloudflare-saas-stack, cloudflare-starter-kit, cloudflare-workers-nextjs-saas-template, cloudflare-workers-d1-r2-expo, fullstack-next-cloudflare, hono-react-ssr | Reference | starter kits |
| r2-explorer, r2-bucket-uploader | **Adopt** | R2 file management; the app stores challenge assets in R2 |
| cloudcore-cms | Reference | Workers-based CMS |
| pastebin-worker | Reference | Workers KV/D1 storage patterns |
| casdoor | Out of scope | full SSO server |

### 2.4 State machines and game state

| Repo | Disposition | Note |
|---|---|---|
| xstate | **Reconcile** | `state_machine_xstate.ts` and `statechart_engine.ts` were ported from it; the app's event lifecycle (DRAFT → READY → LIVE → FROZEN → REVIEW → RESULTS_PUBLISHED → ARCHIVED) is a textbook statechart |
| javascript-state-machine, jssm, typescript-fsm, useStateMachine, state (steelbreeze) | Reference | smaller FSM libraries |
| python-statemachine | Reference | `python_statemachine.ts` ported from it (the port is TypeScript) |
| awesome-fsm | Reference | link list |

### 2.5 Determinism, PRNG and entropy

Directly relevant: the app's personalization and attribution depend on deterministic
seeding, and its README makes strong claims about it.

| Repo | Disposition | Note |
|---|---|---|
| seedrandom, prando, pure-rand, jsrand, yurandom | **Reconcile** | the app has four PRNG modules; pick one, delete three |
| seedspring | Reference | AES-CTR-based seeded PRNG |
| go-hmac-drbg, dice | Reference | HMAC-DRBG (NIST SP 800-90A) and CSPRNG CLI |
| provably-fair-verifier, marbles2d | Reference | HMAC-based provable fairness and a verifiable-race model |
| seeded-iching-engine | Reference | a worked deterministic-replay generator |
| entropy_collector (local) | Reconcile | the app's own collector; confirm it feeds something |

### 2.6 Live updates, leaderboards and realtime

| Repo | Disposition | Note |
|---|---|---|
| better-sse | **Adopt** | the app's SSE is split across a directory, a manager and three routes |
| server-sent-events, demo-spring-sse | Reference | SSE patterns |
| fanout-leaderboard-demo | **Adopt** | realtime leaderboard across devices |
| redis-leaderboard, leaderboard, highscore | Reference | leaderboard data models |
| redis | Out of scope | not currently in the app's stack |
| scorebot | Reference | scoring engine |

### 2.7 Quiz and classroom platforms

The app is built for classroom competitions, so this cluster is closer than the CTF
platforms are.

| Repo | Disposition | Note |
|---|---|---|
| kahoot-cf | **Adopt** | a Cloudflare-native Kahoot clone with Zero Trust auth — the nearest neighbour to this app in the whole corpus |
| classquiz, quizzle, razzia, quizlive, jovvix, quiz-platform, esports-tournament-platform | Reference | classroom/quiz platforms |
| exam-generator, student_exam_generator | **Adopt** | the app has `exam_generator.ts`; verify against these |
| bracket, extend-tournament-system | Reference | tournament brackets; the app has `tournament_ranking.ts` |
| edurange_cloud | Reference | security education hosting |
| game, GAME | Reference | gamification engines; the app has `badge_system.ts` |

### 2.8 OSINT and investigation collections

The app's fiction is an internet investigation. These are the real counterparts.

| Repo | Disposition | Note |
|---|---|---|
| awesome-osint, OSINT-BIBLE, OSINT-Cheat-sheet, non-typical-OSINT-guide, osint-ctfs, D4rk_Intel-OSINT-Investigative-Toolkit, osint-puzzle-game | Reference | real investigative technique; useful for making challenges authentic |
| Awesome-Platforms, awesome-ctf, awesome-ctf-resources, awesome-sec-challenges, awesome-puzzlehunt, awesome-astro | Reference | link collections |
| HackerHolidays, picoctf writeups | Reference | player-facing event framing |

### 2.9 Archiving and replay

| Repo | Disposition | Note |
|---|---|---|
| archivebox | **Reconcile** | the app has `ctf_web_archive.ts` ported from it |
| replayweb.page | **Reconcile** | the static replay feature (`src/lib/static-replay/`, 6 modules) is this idea |
| ctfdump, ctfd_download_python | **Reconcile** | `ctfdump_extractor.ts` |
| ctfd2pages | Reference | turning a live event into a static site — exactly the app's static-replay goal |
| Jeopardy-Dockerfiles, hackergame-challenge-docker | Reference | containerised challenge images; studied for the packaging story only |

### 2.10 Privacy, data handling and out-of-scope infrastructure

| Repo | Disposition | Note |
|---|---|---|
| fides, laravel-personal-data-export | Reference | GDPR-style data export; the app stores participant answers |
| money | Out of scope | Ruby money library |
| PuzzleScript | Out of scope | HTML5 puzzle game engine |
| online-judge (DMOJ) | Reference | judged-programming platform |
| jsrand, prando | (see §2.5) | — |
| ctf-tools | Out of scope | miscellaneous scripts; nothing applicable |

Every one of the 189 corpus repositories is named in this Part, in a row of its own or
in a grouped row. An earlier draft closed with a blanket note claiming the unlisted
repositories were covered by default; that was removed, because a coverage claim that
does not name what it covers cannot be checked. Three repositories appear in two
sections deliberately — `scorebot` (§2.1, §2.6), `edurange_cloud` (§2.1, §2.10) and
`ctfd2pages` (§2.1, §2.9) — because each is relevant to both the platform survey and
the specific capability it is cited for.

**Totals (189 unique repositories):** Adopt 15 — Reconcile 25 — Dependency 1 —
Reference 144 — Out of scope 4.

---

## Part 3 — Absorption plan

Phases 1 and 2 are correctness and security work; the rest is capability.

### Phase 0 — Close the holes (defects 1, 2, 3, 4, 5, 6, 7)

Highest value per line changed; all of it is deletion or small rewrites.

1. Delete `src/pages/api/submit-flag.ts`; remove its row from `src/pages/api-docs.astro`.
   Confirm `POST /api/submit` is the only submission path and that a challenge cannot be
   solved without a D1 solve row.
2. Delete `src/lib/auth.ts`; repoint `src/pages/login.astro:240` at the real
   `GET /api/session`. Confirm `@/lib/auth` resolves to the directory afterwards.
3. Decide team mode: rewrite `src/lib/teams.ts` against D1, or mark it a UI shell in the
   README. Do not leave browser-authoritative team scoring in place.
4. Make `guardAdmin` call `guardAdminWithAccess` so Access is optional, or document Access
   as mandatory. Remove the double `getAccessIdentity` call.
5. Wire `withSecurityHeaders` into `src/middleware/index.ts`, narrow `connect-src` to the
   project host, then delete the inline header blocks in `admin/guard.ts`.
6. Replace `timingSafeEqual` in `admin/auth.ts` with the import from `auth/credentials.ts`.
7. Rewrite `recordFailure` and `recordAdminFailure` as single-statement atomic updates.

### Phase 1 — One implementation per concept (defect 11)

For each row of the duplication table, pick the winner, migrate callers, delete the rest.
The tests decide: if `src/lib/scoring/` is what `src/lib/__tests__/scoring.test.ts`
exercises, it wins and the other ten scoring modules go. This phase has no new features and
will remove more code than it adds, which is the point.

Order: submission → scoring → leaderboard → hints → PRNG → state machines → SSE.

### Phase 2 — Admin visibility (from §2.2)

The app detects copiers but gives the admin nothing to look at. Take the read-only,
evidence-surfacing approach from `ctfd-sharewatch` and `ctfd-flag-sharing`:

1. An admin page listing attribution hits: which normalized answer was submitted by which
   roll, and when.
2. A per-participant view: submissions, strikes, eliminations, with the timeline.
3. An export, so an incident can be reviewed after the event.

This needs no new detection logic — `assignAttributionAnswers` and `buildOwnershipMap`
(`src/lib/crypto/attribution.ts`) already produce the deterministic bijection, and
`submissions` already persists every attempt (`submit.ts:97-103`). The data is complete;
only the view is missing.

### Phase 3 — Bound the cost of auth (defect 8)

Implement lazy auth resolution, then measure: a page with 40 assets should issue zero
session queries beyond the one the page itself needs. The corpus's D1 examples
(§2.3) show the pattern.

### Phase 4 — Decompose the giant page (defect 10)

`[slot].astro` at 174 KB. Split into a shell plus components, with the challenge metadata
resolved server-side. Model the layout on the codebuck/`devportfoliotemplates` structure
of small single-purpose components, or on any of the platform front-ends in §2.1.

### Phase 5 — Capability from the corpus

In rough priority order, each with a clear source:

| Feature | Source | Why |
|---|---|---|
| Realtime leaderboard across devices | `fanout-leaderboard-demo`, `redis-leaderboard` | the app has SSE but a single-process scoreboard |
| Kahoot-style live round | `kahoot-cf`, `quizlive` | the app already absorbed `live_quiz_engine.ts`; this makes it real |
| Scoring simulator | `ctf-scoring-simulator`, `scoring-playground` | validate the formula against 116 participants before an event, not during |
| On-demand challenge instances | `chall-manager`, `klodd` | per-participant instances, if the event ever needs them |
| D1-native auth | `better-auth-cloudflare` | only if the home-grown session system is ever replaced |
| Exam generation | `exam-generator`, `student_exam_generator` | the app has `exam_generator.ts`; finish or delete it |
| R2 asset management UI | `r2-explorer` | challenge assets are in R2 with no browse surface |
| Data export | `fides`, `laravel-personal-data-export` | participant submissions are personal data |

### Phase 6 — Documentation truth (defect 13)

Generate `api-docs.astro` from `openapi.json.ts`. Update the README to match what the app
actually does today: which features are D1-backed, which are browser-only, and which are
absorbed drafts. The current README claims team mode, a live leaderboard and static replay
without distinguishing the three, and it advertises a test count (582) that should be
re-verified after Phase 1's deletions.

---

## Part 4 — Deliberately not doing

- **Adopting a third-party platform.** CTFd, rCTF, GZCTF and the rest are mature, but the
  app's entire premise — cryptographically personalized per-player content with
  attribution-based anti-cheat — is not something any of them offer. The corpus is a
  source of technique, not a replacement.
- **Kubernetes-era infrastructure.** `kctf`, `kube-ctf`, `chall-manager` and `pathwar`
  assume a cluster. The app's value is that it runs on Cloudflare's free tier.
- **Attack–defence platforms.** `forcad`, `checksystem`, `ctf-gameserver` solve a different
  competition format.

---

## Part 5 — Verification

| Phase | Check |
|---|---|
| 0 | `POST /api/submit-flag` returns 404. A grep for `case71c_` returns nothing. `curl` against an admin route succeeds with a valid admin cookie and no `ACCESS_ADMIN_EMAILS` set. Every response carries a CSP header. |
| 1 | One module owns scoring, one owns leaderboard, one owns hints; the scoring test suite passes unchanged against the survivor. `pnpm test` count is the same or higher after deletions. |
| 2 | An admin can see every attribution hit for a seeded event and export it. |
| 3 | A page with 40 assets issues at most one session lookup; measured against D1 query counts. |
| 4 | No source file exceeds ~20 KB; `[slot].astro` renders identically before and after. |
| 5 | Each adopted feature has a test and a line in the README describing what is actually wired. |
| 6 | `api-docs.astro` is generated, not hand-written; README claims match the test suite. |
| 15 | `tests/unit/password.test.ts`: a hash round-trips, a wrong password is rejected, two hashes of one password differ, the scheme/iteration/salt shape is asserted, and a malformed hash returns false instead of throwing. |

Fixed during this audit, verified at the time:

- **§15** — `npx vitest run tests/unit/password.test.ts` passes 6/6. Proven to discriminate by
  restoring the old bare-SHA-256 hash: 4 of the 6 then fail (identical digests for equal
  passwords, no scheme or salt fields, and the stored value containing the plain digest).
- **§16** — the suite goes from 92 failing / 628 passing to **720 passing, 57 files** once
  `better-sqlite3`'s native binding exists.
- The **live** auth path was read and left alone: `src/lib/auth/` stores only the SHA-256 of a
  256-bit opaque token, revokes prior sessions on login with a DB partial-unique index
  backstopping concurrent logins, sets HttpOnly/SameSite=Lax/Secure cookies, HMACs IPs before
  they touch the rate-limit table, and compares credentials in constant time. No defect found
  in it. Note that `validateParticipantCredentials` (`src/lib/auth/credentials.ts`) compares the
  submitted password against the participant's **roll number** in plaintext — a documented
  design choice for this event format, and therefore a policy risk (a roll number is knowable),
  not a bug this audit silently changed.

Final sweep: `grep -rn "client-side for now" src/` returns nothing.

## Part 7 — Second-pass audit and fixes

Status as of 2026-09-12. This pass re-checked the earlier findings against the built artifact and the
real gates. It confirmed most of them, found one that had been rated critical and was still shipped,
and found several the earlier pass missed. It also committed the work that had been sitting in the
working tree uncommitted, with `plan.md` itself untracked.

### 1. The unauthenticated mock flag endpoint was still in the build

`src/pages/api/submit-flag.ts` was rated critical earlier in this plan and left in place. It has no
authentication check of any kind, builds the flag `case_{NN}_flag` for all 30 challenges, and on a
match returns `{ correct: true, points_earned }` with the message "Case cracked! +points.", then
pushes a solve into the live SSE scoreboard through `processSolveEvent`.

```
$ grep -rl 'case_{' dist/
dist/server/chunks/admin_DXd43p-S.mjs
dist/server/chunks/submit-flag_Dunqgw9O.mjs
```

It never touches D1, so the persisted leaderboard was safe; the damage was the fabricated success,
the guessable pattern, and the writes into the public scoreboard (which accepts `teamId` from
`x-forwarded-for`). The real submission path is `/api/submit`. The file is deleted, and its entry in
`src/pages/api-docs.astro`, which advertised the route, is removed with it.

### 2. The only CSP in the repo was dead code

`src/lib/security/headers.ts` had no importer outside itself, so no response carried a
`Content-Security-Policy`. Two reasons it had stayed unwired: the policy as written could not work,
and there was nowhere obvious to put it.

- Its `script-src 'self'` would have blocked the app's own scripts. Astro inlines the hydration
  bootstrap for every island and a server-rendered app has no way to attach a nonce to those inline
  tags, so `'unsafe-inline'` is required for `script-src`.
- `connect-src` named `https://*.pages.dev wss://*.pages.dev`, which would let any Pages preview
  origin receive data from this app.
- `_headers` is the wrong mechanism here. That file decorates static assets only; this app renders
  on demand (`output: 'server'`), so a document never passes through it. Middleware is the only hook
  that sees every response.

The policy is corrected and applied in `src/middleware/index.ts`: `'unsafe-inline'` for scripts,
`connect-src 'self'`, `object-src 'none'` added, and the obsolete `X-XSS-Protection` header dropped
(it is removed from modern browsers and its filter has itself been a vulnerability source). The app
loads nothing off-origin — the only external URLs anywhere in `src/pages`, `src/components` and
`src/layouts` are XML namespace identifiers and one documentation link — so a same-origin policy is
sufficient rather than aspirational.

Reachability is now visible in the build output:

```
$ grep -rl "Content-Security-Policy" dist/
dist/server/virtual_astro_middleware.mjs
```

and `tests/unit/security-headers.test.ts` (new, 5 cases) asserts the header set is present, that the
policy names no external origin, that inline scripts are permitted, and that the header is omitted
when CSP is switched off.

### 3. Three typecheck root causes, 71 errors down to 29

The typecheck had been masked in CI with `|| true`, so nothing had ever reported these.

**`App.Locals` was never declared (71 → 56).** `src/middleware/index.ts` assigns `context.locals.auth`
and twenty-odd routes read it, but no declaration existed, so every access was `Property 'auth' does
not exist on type 'Locals'`. The namespace is now declared in `src/env.d.ts`, referencing the
`AuthContext` type the authenticator actually returns.

**`SecretEnv` was `Record<string, unknown>` (56 → 47).** An interface has no implicit index
signature, so the generated `Env` interface is not assignable to `Record<string, unknown>` and every
caller passing `getEnv()` failed with "Index signature for type 'string' is missing". `SecretEnv` is
now `object` — the honest description of what the resolver needs — and the single indexed read inside
`crypto/secrets.ts` casts instead.

**`InsertableDb` was hand-written and no longer matched Drizzle (47 → 29).** `src/lib/db/seed.ts`
declared `values: (rows: unknown) => ...` to avoid depending on a driver. A parameter typed `unknown`
is contravariant, so the real typed driver is not assignable to it, and all nine test files that call
`seedEvent` failed. It is now `Pick<AnySQLiteDb, 'insert'>`, which is the driver-agnostic alias the
comment always intended.

The remaining 29 are in parked modules (`statechart_engine`, `state_machine_xstate`,
`ctf_edge_deployment`) and test helpers, and are recorded under "Still open".

### 4. CI could not install, could not lint, and reported green

```
$ git ls-files --error-unmatch package-lock.json
error: pathspec 'package-lock.json' did not match any file(s) known to git
$ npm run lint
npm error Missing script: "lint"
```

Every job ran `npm ci`, but only `pnpm-lock.yaml` is tracked and `package-lock.json` is gitignored, so
the install step could never resolve. The lint job ran a script that does not exist, wrapped in
`|| true`. The typecheck was `npx tsc --noEmit || true`, which is why 71 errors were invisible. The
matrix listed Node 18 against `"engines": {"node": ">=22.12.0"}`.

The workflow now uses pnpm with `--frozen-lockfile`, Node 22, a single `verify` job, and no lint step
(there is no linter configured). The typecheck uses `continue-on-error: true` rather than `|| true`:
while 29 errors remain it still reports failure, which is the difference between a visible red X and
a silent green check.

### 5. Verified as still true

| Claim | Evidence |
|---|---|
| The live auth path is sound | `src/lib/auth/password.ts` is PBKDF2-HMAC-SHA256 with a per-hash salt and the iteration count embedded; `credentials.ts` compares in constant time; sessions are SHA-256-hashed opaque tokens |
| No client-side answer leakage | Neither `dist/client/` nor `public/` contains `DEV-PLACEHOLDER`, `case_{`, `EVENT_SECRET` or `privateData` |
| No SQL injection | The only raw SQL is static; the three string-classifier routes return only the caller's own assigned answer, behind auth and event state |
| Scores cannot be forged by a client | No endpoint writes `participants.score`, `solves.final_score` or a timestamp |
| `test-results/` is not committed | `git ls-files test-results/` is empty |
| No committed secrets | `.dev.vars` untracked; `.env.example` holds only `dev-only-change-me-*` placeholders |
| The suite passes | `npx vitest run` → 725 passed, 58 files, exit 0 |
| The build passes | `npx astro build` → exit 0 |

### Still open

- **29 typecheck errors**, all in parked modules and test helpers. The largest single group is
  `tests/unit/q30.test.ts` (9) and `src/pages/api/__tests__/badges.test.ts` (6), both `TS18046`
  treating a JSON read as `unknown`. Make the typecheck blocking once these reach zero.
- **Two files claim the `/admin` route**: `src/pages/admin.astro` (27,007 bytes, the old client-side
  page) and `src/pages/admin/index.astro` (8,347 bytes, the SSR page using `isAdmin`). The build warns
  that a collision will become a hard error in a future Astro version, and which one wins is not
  recorded anywhere. One must be deleted.
- **`/api/submit` and `/api/hint` apply no rate limit.** Only login and admin login are throttled, so
  personalized answers can be brute-forced without bound. The deleted mock had a limiter; the real
  path does not.
- **`/api/register` is an open mock** that sends email through the bound Cloudflare Email service to
  any caller-supplied recipient, and stores nothing. It should be deleted or authenticated.
- **`/api/scoreboard-sse` sets `Access-Control-Allow-Origin: *`** on an unauthenticated stream, and
  holds an interval per connection for 30 minutes.
- **The admin announcement email is silently broken.** `src/lib/email.ts:126` calls `.prepare()` on a
  Drizzle object (no such method) and selects `username` / `eventId` columns that do not exist (they
  are `roll_number` / `event_id`). The error is swallowed by `.catch(() => {})` at the call site in
  `src/pages/api/admin/announce.ts:19`.
- **`src/pages/api-docs.astro` advertises endpoints that do not exist.** It lists `/api/login`,
  `/api/teams`, `/api/teams/join`, `/api/team-score/:teamId` and a `:challengeId` hint route; the real
  hint route is `/api/hint` (singular, body-parameterised) and the others are absent. The
  `/api/submit-flag` entry was removed with the endpoint; the rest still need correcting.
- **`astro.config.mjs:18` uses `sessionDrivers.http()`**, an unstorage HTTP KV driver, while its own
  comment says "pin an in-memory driver". Astro's built-in sessions are unused so the impact is
  config truth, but the comment is wrong.
- **`README.md` claims 582 tests**; the suite is 725.
- **Two client-side systems are not shipped.** `src/lib/auth.ts` and `src/lib/teams.ts` are live under
  `astro dev` only; neither appears in `dist/client/`. The plan's specific `@/lib/auth` resolution
  trap cannot occur — no `@/*` mapping exists — but `src/pages/login.astro` uses the literal
  `/src/lib/auth.ts` specifier, which survives into the server chunks and would 404 against the
  ASSETS binding.

