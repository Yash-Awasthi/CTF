import { constantTimeEqual } from './credentials';

/**
 * Password hashing for the Better Auth configuration.
 *
 * PBKDF2-HMAC-SHA256 with a per-password random salt, reached through Web Crypto
 * because it is the one key-derivation function the Workers runtime exposes
 * unconditionally. A single unsalted SHA-256 digest is not a key derivation: it
 * is fast to compute, identical for every user who picked the same password, and
 * therefore recoverable from a precomputed table the moment the database leaks.
 *
 * The iteration count is stored inside each hash, so it can be raised later
 * without invalidating existing rows. The current value trades strength against
 * the Workers CPU budget, which is the binding constraint on this platform.
 *
 * Output format: `pbkdf2$<iterations>$<salt-hex>$<derived-key-hex>`.
 */

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

/** Parse lowercase hex into bytes; returns null on anything malformed. */
function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
	if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) return null;
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

// Salt is typed as ArrayBuffer-backed: Web Crypto's BufferSource will not accept
// the ArrayBufferLike default that a bare `Uint8Array` widens to.
async function derive(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations: number,
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		key,
		KEY_BITS,
	);
	return new Uint8Array(bits);
}

/** Hash a password for storage. Never called with an already-hashed value. */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const key = await derive(password, salt, ITERATIONS);
	return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(key)}`;
}

/**
 * Verify a password against a stored hash. Returns false for a malformed or
 * unrecognised hash rather than throwing, so a corrupted row cannot turn a
 * failed login into a 500.
 */
export async function verifyPassword(data: {
	password: string;
	hash: string;
}): Promise<boolean> {
	const parts = data.hash.split('$');
	if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
	const iterations = Number(parts[1]);
	if (!Number.isInteger(iterations) || iterations < 1) return false;
	const salt = fromHex(parts[2]!);
	const expected = fromHex(parts[3]!);
	if (!salt || !expected) return false;

	const actual = await derive(data.password, salt, iterations);
	return constantTimeEqual(toHex(actual), toHex(expected));
}
