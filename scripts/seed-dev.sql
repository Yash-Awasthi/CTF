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
