import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const SLUG = 'case-files-dev-2026';
const ROLL = '25115030';

// Drive the dev event state directly (no admin API yet). Restore READY after.
function sql(command: string) {
	execSync(
		`pnpm exec wrangler d1 execute case-files-db --local --command ${JSON.stringify(command)}`,
		{ cwd: process.cwd(), stdio: 'ignore' },
	);
}

async function loginAndOpenHome(page: import('@playwright/test').Page) {
	await page.goto(`/${SLUG}/login`);
	await page.fill('input[name="rollNumber"]', ROLL);
	await page.fill('input[name="password"]', ROLL);
	await page.click('button[type="submit"]');
	await page.waitForURL(`**/${SLUG}/home`);
}

test.beforeAll(() => {
	sql(`UPDATE events SET state='LIVE', started_at=unixepoch(), duration_seconds=3600 WHERE slug='${SLUG}';`);
	// Ensure this participant starts at challenge 1 (default), unlocked slot = 1.
	sql(`UPDATE participants SET current_challenge=1 WHERE roll_number=${ROLL};`);
});

test.afterAll(() => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
});

test('LIVE → open current challenge → stable content → future locked', async ({ page }) => {
	await loginAndOpenHome(page);

	// Home links to the current challenge.
	const link = page.getByRole('link', { name: /Go to challenge 1/ });
	await expect(link).toBeVisible();
	await link.click();

	await page.waitForURL(`**/${SLUG}/challenge/1`);
	await expect(page.getByText('INTERNAL MEMORANDUM')).toBeVisible();

	// Capture the personalized token, then reload → identical (deterministic).
	const tokenLocator = page.locator('dt:text-is("Session") + dd');
	const token1 = (await tokenLocator.textContent())?.trim();
	expect(token1).toBeTruthy();
	await page.reload();
	const token2 = (await tokenLocator.textContent())?.trim();
	expect(token2).toBe(token1);

	// Future challenge locked → URL manipulation redirects back to current (1).
	await page.goto(`/${SLUG}/challenge/2`);
	await page.waitForURL(`**/${SLUG}/challenge/1`);
	await expect(page.getByText('INTERNAL MEMORANDUM')).toBeVisible();

	// API enforces the same progression guard (slot 2 locked → 403).
	const res = await page.request.get(`/api/challenges/2`);
	expect(res.status()).toBe(403);
});

test('invalid slot → 404', async ({ page }) => {
	await loginAndOpenHome(page);
	const res = await page.request.get(`/api/challenges/999`);
	expect(res.status()).toBe(404);
});
