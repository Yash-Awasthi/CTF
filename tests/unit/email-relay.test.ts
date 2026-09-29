import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src', 'pages', 'api');

function apiRoutes(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) return apiRoutes(full);
		return entry.name.endsWith('.ts') ? [full] : [];
	});
}

const IMPORTS_EMAIL = /from\s+['"][^'"]*lib\/email['"]/;

describe('email relay', () => {
	// The Cloudflare Email binding sends to whatever address it is handed. Only
	// the admin routes may reach it, because they take recipients from D1; every
	// other route takes the address from an unauthenticated request body.
	it('is reachable only from the admin routes', () => {
		const offenders = apiRoutes(API_DIR)
			.filter((file) => IMPORTS_EMAIL.test(readFileSync(file, 'utf8')))
			.map((file) => relative(API_DIR, file))
			.filter((route) => !route.startsWith(`admin${sep}`));

		expect(offenders).toEqual([]);
	});
});
