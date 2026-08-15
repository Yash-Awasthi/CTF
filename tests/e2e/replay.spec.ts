import { test, expect } from '@playwright/test';

/**
 * Static replay (Phase 16) — post-event archive. No auth, no backend calls: all
 * personalization + verification is client-side from a local investigatorId.
 */
test('replay: personalized challenge, client-side solve, reset changes investigator', async ({ page }) => {
	await page.goto('/replay/');
	await expect(page.getByRole('heading', { name: 'Case Files — Replay' })).toBeVisible();

	const investigator = page.locator('[data-investigator]');
	await expect(investigator).toHaveText(/Investigator [0-9a-f]{8}/);
	const first = (await investigator.textContent())!.trim();

	// The page derives the expected answer client-side and stores it on the root.
	await expect(page.locator('[data-title]')).not.toBeEmpty();
	const expected = await page.locator('[data-replay]').getAttribute('data-expected');
	expect(expected).toBeTruthy();

	// Wrong answer → incorrect.
	await page.fill('input[name="answer"]', 'nope');
	await page.click('[data-form] button');
	await expect(page.locator('[data-result]')).toHaveText(/Incorrect/);

	// Correct (client-derived) answer → advances to challenge 2.
	await page.fill('input[name="answer"]', expected!);
	await page.click('[data-form] button');
	await expect(page.locator('[data-progress]')).toHaveText(/Challenge 2 \/ 30/);

	// Reset Investigation → new investigator id, back to challenge 1.
	await page.click('[data-reset]');
	await expect(page.locator('[data-progress]')).toHaveText(/Challenge 1 \/ 30/);
	await expect(investigator).not.toHaveText(first);
});
