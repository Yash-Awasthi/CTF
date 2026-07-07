import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const SLUG = 'case-files-dev-2026';

function sql(command: string) {
	execSync(
		`pnpm exec wrangler d1 execute case-files-db --local --command ${JSON.stringify(command)}`,
		{ cwd: process.cwd(), stdio: 'ignore' },
	);
}

test.afterAll(() => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
});

test('public leaderboard is hidden until RESULTS_PUBLISHED, then served with unmasked rolls', async ({ request }) => {
	// During the competition (not published) → 403.
	sql(`UPDATE events SET state='LIVE', started_at=unixepoch(), duration_seconds=3600 WHERE slug='${SLUG}';`);
	const during = await request.get(`/api/leaderboard?event=${SLUG}`);
	expect(during.status()).toBe(403);

	// After publication → 200 with standings + unmasked roll numbers.
	sql(`UPDATE events SET state='RESULTS_PUBLISHED' WHERE slug='${SLUG}';`);
	const after = await request.get(`/api/leaderboard?event=${SLUG}`);
	expect(after.status()).toBe(200);
	const body = await after.json();
	expect(Array.isArray(body.leaderboard)).toBe(true);
	expect(body.leaderboard.length).toBeGreaterThan(0);
	expect(body.leaderboard[0].rollNumber).toBeGreaterThan(25_000_000);
});
