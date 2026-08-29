# 🕵️ Case Files — AI-Narrated Internet Investigation CTF

> **30 puzzles. One story. Cryptographically personalized per player.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-≥22-green.svg)](https://nodejs.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com)
[![Vitest](https://img.shields.io/badge/Tests-1230+-brightgreen.svg)](#testing)

**Case Files** is a browser-based CTF platform where 30 sequential challenges unfold an AI-narrated investigation story. Each player gets **cryptographically unique** challenge content — same puzzle structure, different names, dates, and filenames — so copied answers betray their source.

Built for classroom competitions with 40+ simultaneous players. Zero infrastructure cost on Cloudflare's free tier.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎭 **AI-Narrated Story** | 30 challenges that unfold a cohesive investigation narrative |
| 🔐 **Per-Player Personalization** | HMAC-derived seeds create unique content per participant |
| 🎯 **Attribution Anti-Cheat** | Copied answers are traceable to their source via deterministic bijections |
| ⚡ **Zero-Cost infra** | Runs on Cloudflare Workers + D1 + R2 (free tier) |
| 🏆 **Live Leaderboard** | Real-time scoring with time decay and hint penalties |
| 📊 **Milli-Point Precision** | Integer-only scoring — no floating-point drift |
| 🔑 **Rate-Limited Auth** | HMAC-hashed IPs, per-roll login limits, no permanent lockouts |
| 📦 **Static Replay** | Post-event archive that works without any backend |

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Set up local environment
cp .env.example .dev.vars

# Start dev server
pnpm dev
# → http://localhost:4321
```

### Cloudflare Setup (one-time)

```bash
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create case-files-db
# Copy the database_id into wrangler.jsonc

# Create R2 bucket
pnpm wrangler r2 bucket create case-files-assets

# Generate types + run migrations
pnpm generate-types
pnpm db:generate
pnpm db:migrate:local
pnpm db:seed:local
```

### Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate SQL migration from Drizzle schema |
| `pnpm db:migrate:local` | Apply migrations to local D1 |
| `pnpm db:seed:local` | Seed dev event + 116 participants |
| `pnpm db:reset:local` | Wipe, re-migrate, re-seed |
| `pnpm db:migrate:remote` | Apply to production D1 |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    BROWSER (Player)                       │
│  Astro SSR + React Islands · Tailwind v4 · Countdown     │
├──────────────────────────────────────────────────────────┤
│                   CLOUDFLARE WORKERS                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Auth   │  │ Challenge│  │ Scoring  │  │Anti-Cheat│ │
│  │ (Roll#) │  │  Engine  │  │  Engine  │  │(Attrib.) │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘ │
├──────────────────────────────────────────────────────────┤
│  D1 (SQL)     │  R2 (Assets)     │  SSE (Live Updates)  │
└──────────────────────────────────────────────────────────┘
```

### Challenge Engine

Each challenge is a TypeScript module that implements a `ChallengeModule` interface:

```typescript
interface ChallengeModule {
  metadata: { slot: number; key: string; title: string; basePoints: number; tier: string };
  generate(ctx: GenerationContext): { publicData: unknown; privateData: unknown };
  validate(instance: unknown, answer: string): boolean;
}
```

Modules receive a **seeded RNG** (HMAC-derived, deterministic per player per slot) — they never see secrets or seeds directly.

### Scoring Formula

```
score = base_points × time_factor × hint_factor
```

- **Time factor**: `max(0.5, 1 − (elapsed/duration) × 0.5)` — decays linearly, floors at 50%
- **Hint factor**: `1.0` (no hints) or `0.5` (hint used) — binary, doesn't stack
- **Minimum**: `0.25 × base_points`

All scores are **integer milli-points** (1 pt = 1000 units). No floats in the database.

### Anti-Cheat System

On incorrect answers to attribution-enabled challenges, the system performs an O(1) lookup in a deterministic ownership map:

```
normalizedAnswer → rollNumber
```

- **1st offense**: Strike (not elimination)
- **2nd offense** (different challenge): Disqualified from competitive play

---

## 🔐 Authentication

- **Roll-number login** — username = password = roll number
- **One active session per participant** — new login revokes old session
- **Rate limiting** — 10 failures / 5 min per roll and per IP (HMAC-hashed)
- **12-hour sessions** — auto-expire, no inactivity logout

---

## 🧪 Testing

```bash
pnpm test          # Vitest unit tests (1230+ tests)
pnpm test:e2e      # Playwright end-to-end
```

### Test Coverage

| Area | Tests |
|------|-------|
| Challenge engine | 3,480 combinations (116 players × 30 slots) |
| Scoring | Formula, floors, integer precision, idempotency |
| Anti-cheat | Attribution, strikes, idempotency |
| Auth | Login, sessions, rate limiting, CSRF |
| Admin | Lifecycle, bypass, audit logging |
| Static replay | Personalization, scrubbing, leaderboard export |

---

## 📂 Project Structure

```
CTF/
├── src/
│   ├── lib/
│   │   ├── auth/           # Login, sessions, rate limiting
│   │   ├── challenges/     # Challenge engine + 30 modules
│   │   ├── crypto/         # HMAC, seeded RNG, deterministic PRNG
│   │   ├── scoring/        # Scoring formula + persistence
│   │   ├── anti-cheat/     # Attribution-based cheating detection
│   │   ├── event/          # Event state machine + timer
│   │   ├── admin/          # Admin dashboard + operations
│   │   └── sse/            # Live updates (SSE + polling fallback)
│   ├── pages/              # Astro routes
│   └── components/         # React islands
├── challenges/             # Per-challenge content (01-30)
├── tests/
│   ├── unit/               # Vitest
│   └── e2e/                # Playwright
├── scripts/                # Seed, export, scrub
└── wrangler.jsonc          # Cloudflare config
```

---

## 📊 Event Lifecycle

```
DRAFT → READY → LIVE → FROZEN → REVIEW → RESULTS_PUBLISHED → ARCHIVED
```

- **Lazy expiry**: No cron needed — the next request after `ends_at` auto-freezes
- **Server time is authoritative**: Browser countdown is display-only
- **Max duration**: 6 hours (enforced)

---

## 🏆 Leaderboard

Leaderboard is **only visible** after `RESULTS_PUBLISHED`:

```
Score DESC → Earliest final solve → Roll ASC
```

Excludes disqualified participants. Public rolls are unmasked in results.

---

## 🗺️ Roadmap

- [ ] Production challenge content (30 real puzzles)
- [ ] Team mode (multi-player per entry)
- [ ] Custom event creation UI
- [ ] Webhook integrations (Discord, Slack)

---

## 🤝 Contributing

See the [build plan](ctf-build-plan.md) for the full phase-by-phase architecture. Contributions welcome — open an issue or PR.

---

## 📄 License

[MIT](LICENSE)
