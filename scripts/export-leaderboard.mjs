// Export final public standings from local D1 → public/replay/leaderboard.json.
// Run AFTER the event reaches RESULTS_PUBLISHED. Excludes eliminated
// participants, unmasked rolls, deterministic order. Uses wrangler (export-time
// only); the produced JSON is a plain static asset with no live dependency.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const slug = process.argv[2] ?? 'case-files-dev-2026';
const q = `SELECT p.roll_number AS rollNumber, p.score AS scoreMilli,
  (SELECT COUNT(*) FROM solves s WHERE s.participant_id=p.id) AS solveCount
  FROM participants p JOIN events e ON e.id=p.event_id
  WHERE e.slug='${slug}' AND p.status<>'disqualified'
  ORDER BY p.score DESC, p.roll_number ASC;`;
const out = execSync(
  `pnpm exec wrangler d1 execute case-files-db --local --json --command ${JSON.stringify(q)}`,
  { encoding: 'utf8' },
);
const rows = JSON.parse(out)[0].results;
const standings = rows.map((r, i) => ({
  rank: i + 1, rollNumber: r.rollNumber,
  scoreMilli: r.scoreMilli, score: r.scoreMilli / 1000, solveCount: r.solveCount,
}));
writeFileSync('public/replay/leaderboard.json', JSON.stringify({ generatedFrom: slug, standings }, null, 2));
console.log(`Wrote ${standings.length} standings to public/replay/leaderboard.json`);
