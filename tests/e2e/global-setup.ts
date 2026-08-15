import type { FullConfig } from '@playwright/test';

/**
 * Playwright global setup — warms the Astro dev server BEFORE any timed test.
 *
 * Root cause of the historical "first test times out" flake: `astro dev`
 * compiles each route on its first request. A cold navigation to `/…/home`
 * (which also chains SSR + middleware + D1) could exceed the 30s per-test
 * timeout. We pay that one-time compile cost here, in setup, by hitting the key
 * routes until they respond — so every real test runs against warm routes.
 */
async function warm(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastErr: unknown;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { redirect: 'manual' });
			// Any HTTP response (200/302/401/404) means the route compiled.
			if (res.status > 0) return;
		} catch (e) {
			lastErr = e;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`warmup failed for ${url}: ${String(lastErr)}`);
}

export default async function globalSetup(config: FullConfig) {
	const base = config.projects[0]?.use?.baseURL ?? 'http://localhost:4321';
	const slug = 'case-files-dev-2026';
	const routes = [
		'/',
		`/${slug}/login`,
		`/${slug}/home`,
		`/${slug}/challenge/1`,
		'/api/session',
		'/replay/',
		`/api/leaderboard?event=${slug}`,
	];
	// Server itself may still be booting; give the first route a generous window.
	await warm(`${base}/`, 90_000);
	for (const r of routes) {
		try {
			await warm(`${base}${r}`, 30_000);
		} catch {
			// Non-fatal: a route that 500s cold will still be compiled for tests.
		}
	}
}
