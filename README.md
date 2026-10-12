# Case Files

[![CI](https://github.com/Yash-Awasthi/CTF/actions/workflows/ci.yml/badge.svg)](https://github.com/Yash-Awasthi/CTF/actions/workflows/ci.yml)

A browser capture-the-flag event: thirty sequential challenges that tell one investigation, Case
71-C. Every player gets their own evidence (names, dates, files, audio, images) derived from an
event secret, so copied answers are traced back to their owner. It runs on Cloudflare Workers
with a D1 database, on Astro.

The story and puzzle design live in `PHASE13-story/ctf-story-bible.md`; how each slot plays and how
it was verified is in `CHALLENGE-AUDIT.md`.

## Stack

Astro and React on Cloudflare Workers, D1 (SQLite) through Drizzle, Tailwind, Vitest and
Playwright. Challenge evidence (audio, images, documents) is generated per player at request time.

## Documentation

- `PHASE13-story/ctf-story-bible.md`: the story, characters, and puzzle design
- `CHALLENGE-AUDIT.md`: how each challenge plays and how it was verified
- `PROGRESS.md`: build progress
- `CONTRIBUTING.md`: how to contribute

## Requirements

- Node 22.12 or later, pnpm 11
- A Cloudflare account (only for deploying)

## Run it locally

```bash
pnpm install
cp .env.example .dev.vars        # then replace the three dev secrets (openssl rand -hex 32)
pnpm db:reset:local              # create the local D1, apply migrations, seed the dev event
pnpm dev                         # http://localhost:4321
```

The seeded dev event is `case-files-dev-2026` with roll numbers 25115000–25115115. On the dev
roster the password is the roll number itself. To play:

1. Open `http://localhost:4321/admin?event=case-files-dev-2026`, log in with `ADMIN_SECRET` from
   `.dev.vars`, and press **Start**.
2. Open `http://localhost:4321/`, pick the event, and log in as `25115000` / `25115000`.

On Windows, stop `pnpm dev` before `pnpm db:reset:local`; the running server holds the database files.

## Create a real event

Real events give every participant a random access code instead of the roll-number password.

```bash
pnpm event:create --slug spring-2026 --name "Case Files — Spring 2026" \
  --hours 3 --rolls 25115000-25115059 --apply local
# or: --roster rolls.txt (one roll number per line); use --apply remote for production
```

This writes `events/<slug>/setup.sql` and `events/<slug>/access-codes.csv` (git-ignored). The CSV is
the only copy of the codes: give each player their line and keep the file private. The event is
created in the READY state, so players can log in to the waiting room until you start it. At most
195 participants per event (the codename pool); events last up to 48 hours.

## Deploy to Cloudflare

```bash
pnpm wrangler login
pnpm wrangler d1 create case-files-db          # put the returned database_id in wrangler.jsonc
pnpm wrangler secret put EVENT_SECRET          # three distinct values from openssl rand -hex 32
pnpm wrangler secret put RATE_LIMIT_SECRET
pnpm wrangler secret put ADMIN_SECRET
pnpm db:migrate:remote
pnpm build && pnpm wrangler deploy
pnpm event:create --slug ... --name ... --hours 3 --rolls ... --apply remote
```

Never change `EVENT_SECRET` once an event has started: every player's evidence and answers are
derived from it.

## Running the event

The admin dashboard at `/admin` (password: `ADMIN_SECRET`) lists every event. For the selected
event it can start, freeze, extend, announce, bypass a broken challenge for everyone, reset a
player's session, begin review, and publish results. The event freezes itself when time runs out.
Players never see standings; the leaderboard is public only after results are published.

## How scoring works

`score = base_points × time_factor × hint_factor`, stored as integer milli-points.

- Base points: slots 1–6 score 100, 7–12 score 150, 13–20 score 200, 21–27 score 300, 28–29 score
  350, 30 scores 500.
- Time factor falls linearly from 1.0 to 0.5 over the event.
- Taking any hint halves that challenge's score (once, however many hints).
- Wrong answers to attribution slots (8, 15, 16, 17, 28) that match another player's answer are
  recorded as strikes; a second strike on a different challenge disqualifies.

## Tests

```bash
pnpm test          # Vitest: engine, crypto, scoring, auth, and per-challenge solvability
pnpm test:e2e      # Playwright against pnpm dev
pnpm exec tsc --noEmit
```

## Layout

```
challenges/              the 30 challenge modules, plus shared builders (audio, images, casebook)
src/lib/challenges/      engine, registry, evidence gate
src/lib/{auth,crypto,event,scoring,anti-cheat,admin,sse,...}
src/pages/[event]/       player pages: login, home (casebook), challenge, evidence and tool routes
src/pages/case/          static-URL evidence (some of it changes as the case advances)
scripts/                 dev seed, event:create, replay export
migrations/              D1 schema
```
