import { describe, expect, it } from 'vitest';
import { getSecurityHeaders } from '../../src/lib/security/headers';

describe('security headers', () => {
	it('sets the headers every response depends on', () => {
		const headers = getSecurityHeaders();
		expect(headers['X-Content-Type-Options']).toBe('nosniff');
		expect(headers['X-Frame-Options']).toBe('DENY');
		expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['Permissions-Policy']).toContain('camera=()');
		expect(headers['Strict-Transport-Security']).toContain('max-age=');
	});

	it('does not name any external origin in the policy', () => {
		const csp = getSecurityHeaders()['Content-Security-Policy'];
		expect(csp).toBeDefined();
		expect(csp).not.toMatch(/https?:\/\//);
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("connect-src 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("frame-ancestors 'none'");
	});

	// Astro inlines the hydration bootstrap for each island, so a policy without
	// 'unsafe-inline' blocks the app's own scripts.
	it('permits inline scripts, which the island bootstrap requires', () => {
		expect(getSecurityHeaders()['Content-Security-Policy']).toContain("script-src 'self' 'unsafe-inline'");
	});

	it('omits the obsolete X-XSS-Protection header', () => {
		expect(getSecurityHeaders()['X-XSS-Protection']).toBeUndefined();
	});

	it('omits the policy when CSP is switched off', () => {
		expect(getSecurityHeaders({ csp: false })['Content-Security-Policy']).toBeUndefined();
	});
});
