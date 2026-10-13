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
  own cipher dating a purchase before his birth, and a memo whose draft survives in an editor backup.
- **Q16–Q20, the haunting.** Evidence changes at the same address: the Q7 photograph and the Q15
  memo are served in altered form once the player gets there, and the interface never says so.
  A voicemail with no voice names the owner this player found at Q11; Mira's torn cipher key.
- **Q21–Q24, the false solve.** Audit-log injection, an alibi rebuilt from raw door and card logs, a
  tape with Daniel's name written into its spectrum, and a case board that quotes the player's own
  findings with one of them silently miscopied (records change). Filing it with the correction
  stamps CASE CLOSED; the next item arrives "three minutes after closure".
- **Q25–Q27, the unravelling.** A photograph whose date is printed nowhere: a newspaper issue number
  with one digit under a thumb, a compressed negative-sleeve note and the print stock pin it down;
  the personnel archive holds Daniels by name and by hand, and only the hand, recorded in each era's
  notation, tells the role from the namesakes; Mira's last words are threaded through her surviving
  sentence in base-four zero-width characters and name a Ledger folio.
- **Q28–Q30, the pattern.** The Ledger opens only at that folio and is rebuilt from names found
  across the case, including the player's own answers and codename; it reports how many rows
  reconcile, never which. Q29 is a meta over ten fragments; the terminal verifies the doctrine and
  returns a countersign enciphered under the keeper's name. After Q29 the chrome belongs to the
  Continuity; Q30's record is sealed with a repeating XOR key, and unsealing it names the subject
  (the player) and the witness (the man currently answering to Daniel Reyes).

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

Base points never fall from one slot to the next: 1-6 easy (100), 7-12 medium (150), 13-18 medium
(200), 19-23 hard (250), then 24 (300) rising by 50 per slot to the capstone at 30 (600). From Q24 on
every slot adds a layer the one before did not have: a planted error (24), arithmetic over three
partial sources (25), unit normalisation across eras (26), an unknown base-four mapping with noise
(27), an oracle that only counts (28), a cipher keyed by the meta answer (29) and a crib attack on a
sealed record (30). The dev seed matches the modules. Hint penalty stays at 0.5.

## Per-slot verification

| Slot | Mechanic | How it was checked |
|---|---|---|
| 1-7 | Documents, HTML comment, faded ink, registry, robots.txt, directory IDOR, photo metadata | Played |
| 8 | Catalogue search (SQL injection simulation), attributed origin | UI |
| 9 | Archive viewer; suppressed row only inside the oversized CSV | UI, unit |
| 10 | Doll photo against six register photos; answer is the matching file number | UI by eye, unit |
| 11 | Provenance portal, scope taken from localStorage | UI |
| 12 | Password in an RFC 2047 base64 subject header; server-checked; file listing | Unit |
| 13 | Redacted PDF with an intact text layer | Played |
| 14 | Digit shift with the amount never given; one shift gives a pre-Vale date | Unit, all 116 players |
| 15 | X-Editor header points at the .bak editor backup holding the draft; attributed 2001 date | Unit |
| 16 | Q7's URL now serves the altered photograph; attributed timestamp | Played |
| 17 | Last-Modified forged to 2013; nginx ETag carries the real mtime in hex; attributed date | UI, unit |
| 18 | Morse voicemail naming the player's Q11 owner; carrier spells NAMES REMAIN | Audio decoded in unit, UI |
| 19 | Q15's URL now serves the rewritten memo | Played, unit |
| 20 | Symbol cipher with the key torn after M; margin word PEOPLE | Unit, all 116 players |
| 21 | Audit log via UNION injection | Played |
| 22 | Door and card logs; lost-card trap; personalised room | Solved from CSVs in unit, all 116 |
| 23 | Tape WAV with name and box number painted above 3 kHz | Spectrum read back in unit, UI |
| 24 | Case board quoting the player's findings, one miscopied; filed as NAME / true value | Unit, all 116 |
| 25 | Issue number (one digit hidden) + weekday in pixels, zTXt sleeve, print stock | Unique for all 116, unit |
| 26 | 400 files; four role files among exact-name namesakes, matched by converted handwriting | Unit |
| 27 | Base-four zero-width run threaded through visible text, noise char, folio attributed | Unit, all 116 |
| 28 | Ledger opened at the Q27 folio; count-only verdicts; reference TC-VI-S-NNNN attributed | UI, unit |
| 29 | Meta over ten fragments; VERIFY returns a Vigenère countersign keyed THECONTINUITY | UI, unit |
| 30 | Repeating-key XOR record, crib = clear header; SUBJECT / WITNESS | Solved in UI, unit all 116 |

## Known limits

- Fixed answers remain on 2, 4-7, 9, 13, 19 and 21 where the story depends on them; attribution
  covers 8, 15, 16, 17, 27, 28 and 29, and every answer from Q22 on is personalised.
- Q26 enumeration takes about 35 seconds against local dev.
