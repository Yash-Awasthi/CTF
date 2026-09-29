import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const SLUG = 'case-files-dev-2026';
const ROLL = '25115020';

// Drive the dev event's state directly (no admin API in Phase 3). Serial config
// means these mutations don't race other specs; we restore READY at the end.
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

test.afterAll(() => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
});

test('READY → waiting room', async ({ page }) => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
	await loginAndOpenHome(page);
	await expect(page.getByRole('heading', { name: 'Waiting room' })).toBeVisible();
	await expect(page.getByText(ROLL)).toBeVisible();
});

test('LIVE → competition placeholder with authoritative timer', async ({ page }) => {
	sql(`UPDATE events SET state='LIVE', started_at=unixepoch(), duration_seconds=3600 WHERE slug='${SLUG}';`);
	await loginAndOpenHome(page);
	await expect(page.getByRole('heading', { name: 'The investigation is open.' })).toBeVisible();
	// Authoritative remaining time rendered (hh:mm:ss), close to full hour.
	await expect(page.locator('[data-remaining]')).toHaveText(/00:(59|60|58):/);
});

test('FROZEN → ended state', async ({ page }) => {
	sql(`UPDATE events SET state='FROZEN' WHERE slug='${SLUG}';`);
	await loginAndOpenHome(page);
	await expect(page.getByRole('heading', { name: 'Competition ended.' })).toBeVisible();
});
