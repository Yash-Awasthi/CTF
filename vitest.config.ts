import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/unit/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
		environment: 'node',
		// Roster-wide crypto checks run hundreds of HMAC derivations and exceed 5 s under load.
		testTimeout: 30_000,
	},
});
