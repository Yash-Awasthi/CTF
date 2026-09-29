-- Dev-event seed for local D1 (idempotent-ish: safe to run once on a clean DB).
-- Creates one development event and seeds roll numbers 25115000–25115115
-- (116 participants) INTO that event. Roll numbers are event-scoped, never global.
--
-- Apply:  pnpm db:seed:local
--   (= wrangler d1 execute case-files-db --local --file scripts/seed-dev.sql)

-- Dev event seeded as READY so participants can log in (waiting room) during
-- local development. Real events are created by the admin flow in a later phase.
INSERT INTO events (name, slug, state, duration_seconds, secret_version, created_at)
VALUES ('Case Files — Dev Event', 'case-files-dev-2026', 'READY', 14400, 'v1', unixepoch());

INSERT INTO participants (event_id, roll_number, current_challenge, score, status, created_at)
WITH RECURSIVE roster(n) AS (
  SELECT 25115000
  UNION ALL
  SELECT n + 1 FROM roster WHERE n < 25115115
)
SELECT
  (SELECT id FROM events WHERE slug = 'case-files-dev-2026'),
  n, 1, 0, 'registered', unixepoch()
FROM roster;

-- Challenge rows: operational per-event identity for the 30 code modules,
-- keyed by (event_id, slot). Metadata mirrors the registry (Phase 5); executable
-- generation/validation lives in code, never in the DB. Kept in sync with
-- the challenge modules under challenges/ (tiers, base points, attribution slots 8,16).
INSERT INTO challenges (event_id, slot, tier, base_points, attribution_enabled, prerequisites, created_at)
WITH RECURSIVE slots(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM slots WHERE n < 30
)
SELECT
  (SELECT id FROM events WHERE slug = 'case-files-dev-2026'),
  n,
  CASE WHEN n = 30 THEN 'capstone' WHEN n >= 21 THEN 'hard' WHEN n >= 7 THEN 'medium' ELSE 'easy' END,
  CASE WHEN n = 30 THEN 500 WHEN n >= 28 THEN 350 WHEN n >= 21 THEN 300 WHEN n >= 13 THEN 200 WHEN n >= 7 THEN 150 ELSE 100 END,
  CASE WHEN n IN (8, 16) THEN 1 ELSE 0 END,
  NULL,
  unixepoch()
FROM slots;
