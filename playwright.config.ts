import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
	testDir: './tests/e2e',
	// Serial: the small auth suite shares one dev server + local D1 (and a single
	// client IP for rate limiting), so parallel workers would race. Determinism
	// over speed here.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	// One retry locally too: absorbs the rare residual cold-compile/wrangler-exec
	// hiccup so a clean cold run is reliably green (warmup handles the common case).
	retries: 1,
	reporter: 'list',
	// Warm every key route before the first timed test (fixes the cold-compile flake).
	globalSetup: './tests/e2e/global-setup.ts',
	timeout: 45_000,
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry',
		navigationTimeout: 30_000,
		actionTimeout: 15_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// `astro dev` daemonizes (foreground process exits), which Playwright
		// treats as "exited early"; `tail` keeps the webServer process alive.
		// When a dev server is already up, reuseExistingServer skips this entirely.
		command: 'pnpm dev && tail -f /dev/null',
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
