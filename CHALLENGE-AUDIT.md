# Challenge audit

All 30 slots were played on a fresh local database (`pnpm db:reset:local`, `pnpm dev`) as a
participant with Playwright: every page loads, every artifact route answers, and every slot accepts
its answer and advances. Slots with in-page tools or new evidence were also solved through the UI.

## Delivery rules

- Static evidence routes under `/case/*` and event routes require a login and an unlocked slot
  (`src/lib/challenges/artifact-gate.ts`), and are marked privately cacheable.
- Modules can serve personalised evidence through `artifact()`; the route
  `/{event}/evidence/{slot}/{name}` applies the same gate.
- Answers never appear in page data for slots 10, 12, 15, 18, 23, 25 and 26.

## Difficulty ramp

Slots 1-6 easy (100), 7-12 medium (150), 13-20 medium (200), 21-27 hard (300), 28-29 hard (350),
30 capstone (500). The dev seed now matches the modules. Hint penalty stays at 0.5.

## Per-slot status

| Slot | Delivery | Verified |
|---|---|---|
| 1-7 | In-page documents, robots.txt, directory, photo metadata | Played |
| 8 | Catalogue search (SQL injection simulation) | Solved through UI |
| 9 | Archive viewer, oversized inventory CSV | Solved through UI |
| 10 | Doll photo vs 1978 register photos (SVG); answer is the matching file number | Solved by eye through UI |
| 11 | Provenance portal, scope from localStorage | Solved through UI |
| 12 | Reyes portal: server checks the reference code, then lists files | Solved through UI |
| 13-14, 16, 19-22, 24, 28-30 | Documents, headers, ciphers, audit log | Played |
| 14, 20 | Ciphers | Solved from page text for all 116 participants (unit test) |
| 15 | Draft comment in memo source, attributed 2001 date | Played |
| 17 | Last-Modified header, attributed date | Played; copied answer flagged |
| 18 | Morse voicemail WAV plus in-page spectrogram | Decoded from audio (unit test), solved through UI |
| 23 | Tape WAV with name and box number in the spectrum | Read back from audio (unit test), solved through UI |
| 25 | Grayscale PNG: newspaper date in pixels, sleeve and stock in text chunks | Solved through UI |
| 26 | 400 numbered personnel files, one indexed | Enumerated from the browser and solved |
| 27 | Final notebook page | Pasted sentence accepted (unit test) |

## Known limits

- Fixed answers remain on 2, 4-7, 9, 13, 19-22, 24 and 27-29, where the story depends on them;
  attribution covers 8, 15, 16 and 17.
- Q18 draws from ten phrases, so collisions between participants are expected.
- Q26 enumeration takes about 35 seconds in local dev.
