import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
	const migrations = await readD1Migrations('./migrations');
	return {
		test: {
			// Roster-wide crypto checks run hundreds of HMAC derivations and exceed 5 s under load.
			testTimeout: 30_000,
			projects: [
				{
					extends: true,
					test: {
						name: 'unit',
						include: ['tests/unit/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
						environment: 'node',
					},
				},
				{
					extends: true,
					// D1-backed tests run inside workerd against a real local D1.
					plugins: [
						cloudflareTest({
							main: './tests/workers/worker.ts',
							wrangler: { configPath: './wrangler.jsonc' },
							miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
						}),
					],
					test: {
						name: 'workers',
						// workerd cannot read Vitest's on-disk module cache through its virtual fs.
						fsModuleCache: false,
						include: ['tests/workers/**/*.test.ts'],
					},
				},
			],
		},
	};
});
