# Plan status

## DECISION NEEDED — one question, answer in one message

This repo has two documents that each read like the master plan, and nothing states which one governs:

- `ctf-build-plan.md` (root) — the phased technical build spec (Phase 0–17: scaffold, schema, auth, scoring, admin, deployment, replay, wrap-up). Its Phase 13 section treats the story bible as an input to one phase.
- `PHASE13-story/ctf-worldbuilding-plan.md` — the Case 71-C story bible: complete history, character bios, the full 30-challenge design table (§20), and per-challenge scene breakdowns (§21–28). It reads as a complete, self-contained design document, with its own open flags at the bottom (§"Open flags for build").

**Pick one, in one message:**

1. **`ctf-build-plan.md` is the sole master plan.** The worldbuilding doc stays a subordinate reference feeding Phase 13 only — its own open flags get folded into `ctf-build-plan.md`'s open-items list before Phase 13 starts.
2. **The two documents merge into one master plan.** Say which becomes the surviving file (or that a new combined file should be created) and what happens to the other.
3. **Neither — some other arrangement.** State it.

Nothing else in this repo is blocked on anything but this answer. Once it lands, the three items under "Open items before Phase 13 content-writing starts" in `ctf-build-plan.md` can be closed out (see the DRAFT proposal below for one of them) and real challenge authoring can start.

No other open calls. Working tree is clean, `main` is even with `origin/main`, and no other branch exists to fold or go stale.

## DRAFT / PROPOSED — per-challenge technique table

Not committed as final. `ctf-build-plan.md`'s Phase 13 open items ask for "the per-challenge technique assignment table (which of the 30 slots gets SQLi, PCAP, metadata, etc.)". `ctf-worldbuilding-plan.md` §20 already has a full 30-row table with a Technique column, decided as part of the story design. The table below is only that column extracted and restated as a standalone proposal for the build-spec side of the decision — no story content invented here, no new technique choices made here. If decision item 1 above resolves in favor of the worldbuilding doc governing content, this table is redundant and can be dropped; if `ctf-build-plan.md` needs its own copy, this is the proposed one.

| Slot | Tier | Technique | Personalized | Mutable |
|---|---|---|---|---|
| 1 | easy | system-generated personalization, no puzzle | Yes | No |
| 2 | easy | HTML/source inspection | No | No |
| 3 | easy | image investigation | Yes | No |
| 4 | easy | filename inspection + cross-reference | Yes | No |
| 5 | easy | robots.txt / hidden path discovery | Yes | No |
| 6 | easy | parameter enumeration / IDOR | Yes | No |
| 7 | easy | EXIF + visual inspection | Yes | Yes (→16) |
| 8 | easy | beginner SQL injection | Yes | No |
| 9 | easy | ZIP/archive investigation + checksum comparison | Yes | No |
| 10 | easy | visual comparison | Yes | No |
| 11 | medium | client-side state manipulation | Yes | No |
| 12 | medium | weak/reused credential guessing | Yes | No |
| 13 | medium | improper PDF redaction / text extraction | No | No |
| 14 | medium | layered beginner encoding | Yes | No |
| 15 | medium | HTML/source inspection | No | Yes (→19) |
| 16 | medium | metadata diff / visual re-inspection | Yes | Yes (from 7) |
| 17 | medium | HTTP header inspection / cached-version comparison | No | Yes |
| 18 | medium | audio review + personalization check | Yes | No |
| 19 | medium | hash comparison / file diff | No | Yes (from 15) |
| 20 | medium | substitution cipher / contextual decoding | No | No |
| 21 | hard | beginner SQL injection (second instance) | No | No |
| 22 | hard | timeline reconstruction / cross-referencing | No | No |
| 23 | hard | beginner audio forensics | No | No |
| 24 | hard | none — synthesis/combination of prior answers | No | No |
| 25 | hard | multi-source metadata verification | No | No |
| 26 | hard | archive traversal + pattern correlation | No | No |
| 27 | hard | steganography-lite / structural extraction | No | No |
| 28 | hard | database investigation + corrupted-data reconstruction | Yes | No |
| 29 | hard | cross-challenge synthesis / correlation | Yes | No |
| 30 | capstone | recall — no puzzle mechanic | Yes | No |

Source: `ctf-worldbuilding-plan.md` §20, Technique/Personalized/Mutable columns only. Base-point tiers per slot still track `ctf-build-plan.md`'s proposed tier bands (Q1–10 easy/100, Q11–20 medium/200, Q21–29 hard/300, Q30 capstone/500) — the third open item (confirm or adjust those numbers) is untouched here.

## Where the build actually stands

Per `PROGRESS.md`:

- Phase 0 through Phase 12.5 done (scaffold, schema, auth, event lifecycle, personalization/crypto, challenge engine, scoring, submission + hints, anti-cheat, first blood, leaderboard, admin, SSE, opaque admin sessions).
- Phase 13 (production challenge content — the real 30 challenges) is deferred. Phases 14 to 16 were completed against the Phase 5 placeholder challenge set, not real content: 30 placeholder modules, two attribution placeholders (slots 8, 16), and one minimal Hello-World fixture on slot 1 run through the real submit/hint/score/first-blood pipeline.

So the platform mechanics are built and tested (3,480-combination deterministic coverage, sampled Playwright journeys, static replay mode). What's missing is the content layer: no production challenges, no locked story copy in the actual challenge modules, no production assets.

## What's broken or half-built

- Phase 13 is blocked, not broken — the three open items below are unanswered, and `ctf-build-plan.md` says explicitly not to write challenge content until they're settled.
- The doc-authority question above is the only structural problem in the docs themselves; nothing else is contradictory or half-migrated.
- No code-level breakage is recorded in `PROGRESS.md` beyond known, already-mitigated test flakes (cold-start Playwright compile, occasional `wrangler d1 execute` hiccup in specs) — both are environment flake, not logic bugs, and the cold-start one already has a fix (`global-setup.ts` warms routes).

## Concrete next steps

1. Get the doc-authority decision above answered so the story bible has a settled place in the doc hierarchy before it's used to write challenge content.
2. Resolve the three open items blocking Phase 13, listed at the bottom of `ctf-build-plan.md`:
   - Confirm story/theme specifics (agency name, case name, final-mystery synthesis) — likely already answered by the Case 71-C story bible, but needs to be pointed to explicitly once item 1 is settled.
   - Adopt, adjust, or reject the DRAFT technique table above (or confirm the worldbuilding doc's §20 table stands as-is).
   - Confirm or adjust the base-point tier numbers in `ctf-build-plan.md`.
3. Once unblocked, author the 30 production challenges one at a time against the existing Phase 5 interface (`challenge.ts`, `generator.ts`, `validator.ts`, `hints.ts`, `assets/`), replacing the placeholder set — engine and pipeline are already proven and should not need to change.
4. Re-run the full Phase 14 test pass (3,480-combination deterministic layer, sampled Playwright journeys, load check) against real content before Phase 15 deployment.
5. Repo note: an untracked sibling folder, `CTFplayground`, is a same-shaped Astro project and looks like a duplicate of this repo — worth confirming which one is the live working copy before more work lands in either.
