import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { generateChallengeForParticipant } from '../../src/lib/challenges';

const SLUG = 'case-files-dev-2026';
const ROLL = 25_115_031;
const SLOT = 1; // Q1, not attribution-enabled

function sql(command: string) {
	execSync(
		`pnpm exec wrangler d1 execute case-files-db --local --command ${JSON.stringify(command)}`,
		{ cwd: process.cwd(), stdio: 'ignore' },
	);
}

/** Read the dev EVENT_SECRET the running server uses, from .dev.vars. */
function devEventSecret(): string {
	const raw = readFileSync(join(process.cwd(), '.dev.vars'), 'utf8');
	const m = raw.match(/^EVENT_SECRET="?([^"\n]+)"?/m);
	if (!m) throw new Error('EVENT_SECRET not found in .dev.vars');
	return m[1];
}

/** Compute this participant's correct answer for SLOT via the same engine. */
async function correctAnswer(): Promise<string> {
	const env = { EVENT_SECRET: devEventSecret() };
	const event = { slug: SLUG, secretVersion: 'v1' };
	// Roster = the fixed dev roll range; attribution isn't used for SLOT 1.
	const roster = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);
	const { instance } = await generateChallengeForParticipant(
		{ env, event, rollNumber: ROLL, roster },
		SLOT,
	);
	return (instance.privateData as { answer: string }).answer;
}

test.beforeAll(() => {
	sql(`UPDATE events SET state='LIVE', started_at=unixepoch(), duration_seconds=3600 WHERE slug='${SLUG}';`);
	// Fresh state for this participant: back to slot 1, no prior hints/solves.
	sql(`UPDATE participants SET current_challenge=1, score=0 WHERE roll_number=${ROLL};`);
	sql(`DELETE FROM hint_usage WHERE participant_id=(SELECT id FROM participants WHERE roll_number=${ROLL});`);
	sql(`DELETE FROM solves WHERE participant_id=(SELECT id FROM participants WHERE roll_number=${ROLL});`);
	sql(`DELETE FROM submissions WHERE participant_id=(SELECT id FROM participants WHERE roll_number=${ROLL});`);
});

test.afterAll(() => {
	sql(`UPDATE events SET state='READY', started_at=NULL WHERE slug='${SLUG}';`);
});

async function login(page: import('@playwright/test').Page) {
	await page.goto(`/${SLUG}/login`);
	await page.fill('input[name="rollNumber"]', String(ROLL));
	await page.fill('input[name="password"]', String(ROLL));
	await page.click('button[type="submit"]');
	await page.waitForURL(`**/${SLUG}/home`);
}

test('hint reveal persists + incorrect then correct solve advances', async ({ page }) => {
	page.on('dialog', (d) => d.accept()); // confirm() on hint reveal

	await login(page);
	await page.goto(`/${SLUG}/challenge/${SLOT}`);
	await expect(page.getByText('INTERNAL MEMORANDUM')).toBeVisible();

	// Reveal hint 1 → appears.
	await page.click('[data-hint-button]');
	await expect(page.locator('[data-hint-list] li[data-hint-number="1"]')).toBeVisible();

	// Persists across refresh.
	await page.reload();
	await expect(page.locator('[data-hint-list] li[data-hint-number="1"]')).toBeVisible();

	// Incorrect submission shows a safe error, no advance.
	await page.fill('input[name="answer"]', 'definitely-wrong');
	await page.click('[data-submit-form] button[type="submit"]');
	await expect(page.locator('[data-result]')).toHaveText(/not recognised/);

	// Correct submission → advances to challenge 2.
	const answer = await correctAnswer();
	await page.fill('input[name="answer"]', answer);
	await page.click('[data-submit-form] button[type="submit"]');
	await page.waitForURL(`**/${SLUG}/challenge/2`);
	await expect(page.getByText('OFFICIAL CASE RECORD')).toBeVisible();

	// Previously solved challenge 1 is now read-only (no submit form).
	await page.goto(`/${SLUG}/challenge/1`);
	await expect(page.getByText(/now read-only/)).toBeVisible();
	await expect(page.locator('[data-submit-form]')).toHaveCount(0);
});
