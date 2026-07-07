import { test, expect } from '@playwright/test';

const SLUG = 'case-files-dev-2026';

// Distinct roll numbers per test so parallel runs never collide on the
// one-active-session invariant or the per-roll rate limiter.
const HAPPY_ROLL = '25115000';
const BADCREDS_ROLL = '25115010';

async function submitLogin(
	page: import('@playwright/test').Page,
	roll: string,
	pw: string,
) {
	await page.goto(`/${SLUG}/login`);
	await page.fill('input[name="rollNumber"]', roll);
	await page.fill('input[name="password"]', pw);
	await page.click('button[type="submit"]');
}

test('login → protected page → refresh persists → logout → blocked', async ({
	page,
}) => {
	await submitLogin(page, HAPPY_ROLL, HAPPY_ROLL);

	await page.waitForURL(`**/${SLUG}/home`);
	await expect(page.getByText(HAPPY_ROLL)).toBeVisible();

	// Refresh → server-side session restores identity (survives reload)
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`/${SLUG}/home$`));
	await expect(page.getByText(HAPPY_ROLL)).toBeVisible();

	// Logout → back to login
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.waitForURL(`**/${SLUG}/login`);

	// Protected page now inaccessible → redirected to login
	await page.goto(`/${SLUG}/home`);
	await expect(page).toHaveURL(new RegExp(`/${SLUG}/login$`));
});

test('invalid credentials show a generic error and stay on login', async ({
	page,
}) => {
	await submitLogin(page, BADCREDS_ROLL, '00000000');
	await expect(page.getByRole('alert')).toContainText(/incorrect/i);
	await expect(page).toHaveURL(new RegExp(`/${SLUG}/login`));
});
