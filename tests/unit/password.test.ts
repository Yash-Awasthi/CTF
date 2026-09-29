import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password';

describe('password hashing', () => {
	it('round-trips a password', async () => {
		const hash = await hashPassword('roll-2024-cse-117');
		expect(await verifyPassword({ password: 'roll-2024-cse-117', hash })).toBe(true);
	});

	it('rejects a wrong password', async () => {
		const hash = await hashPassword('correct-horse');
		expect(await verifyPassword({ password: 'correct-horsf', hash })).toBe(false);
		expect(await verifyPassword({ password: '', hash })).toBe(false);
	});

	it('salts every hash, so equal passwords never share a digest', async () => {
		const a = await hashPassword('same-password');
		const b = await hashPassword('same-password');
		expect(a).not.toBe(b);
		// both still verify against their own hash
		expect(await verifyPassword({ password: 'same-password', hash: a })).toBe(true);
		expect(await verifyPassword({ password: 'same-password', hash: b })).toBe(true);
	});

	it('records the scheme, iteration count and a 16-byte salt', async () => {
		const hash = await hashPassword('x');
		const [scheme, iterations, salt, key] = hash.split('$');
		expect(scheme).toBe('pbkdf2');
		expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
		expect(salt).toMatch(/^[0-9a-f]{32}$/);
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});

	it('returns false for malformed hashes instead of throwing', async () => {
		for (const bad of [
			'',
			'deadbeef',
			'pbkdf2$abc$00$00',
			'pbkdf2$0$00$00',
			'pbkdf2$1000$xyz$ab',
			'pbkdf2$1000$00$ab', // short key
			'bcrypt$1000$00$ab', // unknown scheme
		]) {
			expect(await verifyPassword({ password: 'x', hash: bad })).toBe(false);
		}
	});

	it('is not a plain digest of the password', async () => {
		// the legacy scheme stored SHA-256(password) as hex
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode('x'),
		);
		const legacy = Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		const hash = await hashPassword('x');
		expect(hash).not.toContain(legacy);
	});
});
