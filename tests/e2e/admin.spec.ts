import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const SLUG = 'case-files-dev-2026';

function sql(command: string) {
	execSync(
		`pnpm exec wrangler d1 execute case-files-db --local --command ${JSON.stringify(command)}`,
		{ cwd: process.cwd(), stdio: 'ignore' },
	);
}
function adminPassword(): string {
	const raw = readFileSync(join(process.cwd(), '.dev.vars'), 'utf8');
	return raw.match(/^ADMIN_SECRET="?([^"\n]+)"?/m)![1];
}

test.afterAll(() => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
});

test('admin API requires the admin cookie; participant session does not grant it', async ({ request }) => {
	// Unauthenticated admin API → 401.
	const un = await request.get(`/api/admin/overview?event=${SLUG}`);
	expect(un.status()).toBe(401);

	// Wrong password → 401, no cookie.
	const bad = await request.post('/api/admin/login', { data: { password: 'nope' } });
	expect(bad.status()).toBe(401);

	// Correct password → dashboard API works.
	const ok = await request.post('/api/admin/login', { data: { password: adminPassword() } });
	expect(ok.status()).toBe(200);
	const overview = await request.get(`/api/admin/overview?event=${SLUG}`);
	expect(overview.status()).toBe(200);
	const body = await overview.json();
	expect(body.participantCount).toBe(116);
	expect(Array.isArray(body.leaderboard)).toBe(true);
});

test('participant login does not grant admin access', async ({ page }) => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
	await page.goto(`/${SLUG}/login`);
	await page.fill('input[name="rollNumber"]', '25115040');
	await page.fill('input[name="password"]', '25115040');
	await page.click('button[type="submit"]');
	await page.waitForURL(`**/${SLUG}/home`);
	// The participant session cookie must NOT authorize admin APIs.
	const res = await page.request.get(`/api/admin/overview?event=${SLUG}`);
	expect(res.status()).toBe(401);
});

test('admin timer extension respects the 6h cap and freeze works', async ({ request }) => {
	sql(`UPDATE events SET state='LIVE', started_at=unixepoch(), duration_seconds=3600 WHERE slug='${SLUG}';`);
	await request.post('/api/admin/login', { data: { password: adminPassword() } });

	const ok = await request.post('/api/admin/extend', { data: { eventSlug: SLUG, seconds: 3600 } });
	expect(ok.status()).toBe(200);

	// 6h cap: pushing beyond 21600 total is rejected.
	const tooMuch = await request.post('/api/admin/extend', { data: { eventSlug: SLUG, seconds: 21600 } });
	expect(tooMuch.status()).toBe(409);

	const freeze = await request.post('/api/admin/freeze', { data: { eventSlug: SLUG } });
	expect(freeze.status()).toBe(200);
});
