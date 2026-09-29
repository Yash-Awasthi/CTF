# Challenge audit

All 30 slots were played on a fresh local database (`pnpm db:reset:local`, `pnpm dev`) as a
participant with Playwright: every page loads, every artifact route answers, and every slot accepts
its answer and advances. Slots with tools, evidence files or new mechanics were also solved through
the UI. Unit tests solve the puzzles from what the player is shown (ciphers, audio, logs, archives)
for every participant on the dev roster.

## How the case plays

- **Q1–Q9, the trail.** A reassigned cold case, a notebook, a dead dollmaker's deed, a hidden
  heritage page, a removed directory entry, a photograph that counts seven under a caption of six,
  an injectable auction catalogue and an archive file bigger than its manifest.
- **Q10–Q15, the collection.** A doll with a real woman's face (image comparison), a provenance portal
  that hides what it is told to, Daniel's portal, a redaction that only covers the surface, Vale's
  own cipher dating a purchase before his birth, and a memo whose draft survives in the source.
- **Q16–Q20, the haunting.** Evidence changes at the same address: the Q7 photograph and the Q15
  memo are served in altered form once the player gets there, and the interface never says so.
  A voicemail with no voice names the owner this player found at Q11; Mira's torn cipher key.
- **Q21–Q24, the false solve.** Audit-log injection, an alibi rebuilt from raw door and card logs, a
  tape with Daniel's name written into its spectrum, and a case board that quotes the player's own
  findings. Solving it stamps CASE CLOSED; the next item arrives "three minutes after closure".
- **Q25–Q27, the unravelling.** A photograph dated from three sources shows D. Reyes decades early;
  an enumerable personnel archive holds one Daniel per cycle; Mira's last words sit in a line of
  zero-width characters.
- **Q28–Q30, the pattern.** The Ledger is rebuilt from names found across the case, including the
  player's own answers and codename; only then does it print the current row. Q29 is a meta over
  ten fragments set aside earlier; a terminal verifies the doctrine and shows its initials. After
  Q29 the chrome belongs to the Continuity, and Q30 asks the player to identify the subject.

Every solve files a case-log entry shown on the home page, so the story can be reread in order.

## Delivery rules

- Evidence is served only to logged-in players whose slot is unlocked (`artifact-gate.ts`), and is
  never cached publicly. Modules serve personalised files through `artifact()` at
  `/{event}/evidence/{slot}/{name}`.
- Answers for slots 9, 10, 12, 14, 15, 17, 18, 20, 22, 23, 25–28 never appear readable in page
  data; they exist only inside evidence the player has to inspect or decode.
- Modules can read the same player's earlier instances (`ctx.related`), which is how Q18, Q24 and
  Q28 echo that player's own discoveries.

## Difficulty ramp

Slots 1-6 easy (100), 7-12 medium (150), 13-20 medium (200), 21-27 hard (300), 28-29 hard (350),
30 capstone (500). The dev seed matches the modules. Hint penalty stays at 0.5.

## Per-slot verification

| Slot | Mechanic | How it was checked |
|---|---|---|
| 1-7 | Documents, HTML comment, faded ink, registry, robots.txt, directory IDOR, photo metadata | Played |
| 8 | Catalogue search (SQL injection simulation), attributed origin | UI |
| 9 | Archive viewer; suppressed row only inside the oversized CSV | UI, unit |
| 10 | Doll photo against six register photos; answer is the matching file number | UI by eye, unit |
| 11 | Provenance portal, scope taken from localStorage | UI |
| 12 | Portal password checked on the server, then the file listing | UI, unit |
| 13 | Redacted PDF with an intact text layer | Played |
| 14 | Digit shift with the amount never given; one shift gives a pre-Vale date | Unit, all 116 players |
| 15 | Draft comment in the memo source; attributed 2001 date | Played, unit |
| 16 | Q7's URL now serves the altered photograph; attributed timestamp | Played |
| 17 | Last-Modified header; attributed date; copies flagged | Played, unit |
| 18 | Morse voicemail naming the player's Q11 owner; carrier spells NAMES REMAIN | Audio decoded in unit, UI |
| 19 | Q15's URL now serves the rewritten memo | Played, unit |
| 20 | Symbol cipher with the key torn after M; margin word PEOPLE | Unit, all 116 players |
| 21 | Audit log via UNION injection | Played |
| 22 | Door and card logs; lost-card trap; personalised room | Solved from CSVs in unit, all 116 |
| 23 | Tape WAV with name and box number painted above 3 kHz | Spectrum read back in unit, UI |
| 24 | Case board quoting the player's own findings; CASE CLOSED | UI |
| 25 | Grayscale PNG dated by newspaper pixels, negative sleeve and print stock | UI, unit |
| 26 | 400 numbered personnel files, one indexed | Enumerated from the browser, unit |
| 27 | Zero-width steganography, mapping varied per player | Decoded from the rendered page, unit |
| 28 | Ledger rebuilt from the case; reference TC-VI-S-NNNN attributed; copies flagged | UI, unit |
| 29 | Meta over ten fragments; terminal VERIFY shows the initials | UI, unit |
| 30 | Own codename, shown in the chrome all along; known wrong names answered | UI |

## Known limits

- Fixed answers remain on 2, 4-7, 9, 13, 19, 21, 24, 27, 29 where the story depends on them;
  attribution covers 8, 15, 16, 17 and 28, and several other answers are personalised.
- Q26 enumeration takes about 35 seconds against local dev.
