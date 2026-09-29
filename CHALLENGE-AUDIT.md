# Challenge audit

Static review of the 30 challenge modules against the pages and routes that deliver them. Nothing here
has been played in a browser: the local workerd runtime crashes on startup (`std::terminate`), so every
"needs play-through" entry is unverified.

## Delivery rules now enforced

- Static evidence routes under `/case/*` (Q7 photo, Q13 PDF, Q15 and Q19 memos, Q17 archive) require a
  login and an unlocked slot, through `src/lib/challenges/artifact-gate.ts`. Before this change any URL
  guess skipped the progression order.
- Event-scoped routes (auction search, provenance, directory, archive, altered photo, records search)
  were already gated.

## Difficulty ramp

Slots 1-6 easy (100), 7-12 medium (150), 13-20 medium (200), 21-27 hard (300), 28-29 hard (350),
30 capstone (500). Hint penalty stays at 0.5 and event length may reach 48 hours.

## Per-slot status

| Slot | Delivery | Verdict |
|---|---|---|
| 1 | In-page memo, personalised codename | Fine |
| 2 | In-page case file, answer in an HTML comment | Fine |
| 3 | Inline SVG with faded ink | Needs play-through: legibility |
| 4 | In-page registry result | Needs play-through |
| 5 | In-page fake heritage site | Needs play-through |
| 6 | `/{event}/directory/[id]` | Fine |
| 7 | `/case/photo/vale-estate` (gated) | Fine |
| 8 | `/{event}/auction/search` (SQL injection simulation) | Fine |
| 9 | In-page archive browser plus `/{event}/archive` | Needs play-through |
| 10 | Prompt text only | Weak: the title gives the answer away and no image comparison exists |
| 11 | `/{event}/provenance/q11` (localStorage scope) | Fine |
| 12 | In-page portal with credentials in a message | Needs play-through |
| 13 | `/case/pdf/ownership-transfer` (gated) | Fine |
| 14 | Prompt text with a two-pass cipher | Needs a solvability check per personalised date |
| 15 | `/case/memo/daniel-reyes` (gated) | Fine |
| 16 | `/{event}/case/photo/altered` | Fine |
| 17 | `/case/archive/vale-estate` (gated, Last-Modified header) | Fine |
| 18 | Browser speech synthesis | Weak: no transcript fallback when speech is unavailable |
| 19 | `/case/memo/daniel-reyes-v2` (gated) | Fine |
| 20 | Prompt text with a substitution cipher | Needs a solvability check |
| 21 | `/api/search/records` (SQL injection simulation) | Fine |
| 22 | Prompt text cross-reference | Needs play-through |
| 23 | Prompt text only | Weak: the transcript states the answer in plain text; no audio exists |
| 24 | Prompt text synthesis | Acceptable as a false-resolution beat |
| 25 | Prompt text, three sources | Weak: no image or metadata to inspect |
| 26 | Prompt text enumeration | Weak: nothing to enumerate |
| 27 | Prompt text with spacing anomalies | Needs play-through: whitespace may collapse in HTML |
| 28 | In-page ledger table | Needs play-through |
| 29 | In-page terminal | Needs play-through |
| 30 | Final terminal, answer is own codename | Needs play-through |

## Known design limit

Fixed-answer slots (13, 15, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29) can be shared between
participants. Only attribution-enabled slots (8 and 16) detect copying.
