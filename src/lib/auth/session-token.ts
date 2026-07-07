import { SESSION_TOKEN_BYTES } from './constants';

/**
 * Session token primitives. The browser holds the raw opaque token; the DB
 * stores only its SHA-256 hash. Tokens are pure CSPRNG output — never derived
 * from roll number, EVENT_SECRET, or a participant seed.
 */

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Generate a fresh 256-bit opaque session token (base64url). */
export function generateSessionToken(): string {
	const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	return toBase64Url(bytes);
}

/** Deterministic SHA-256 of the raw token, hex-encoded. This is what D1 stores. */
export async function hashSessionToken(rawToken: string): Promise<string> {
	const data = new TextEncoder().encode(rawToken);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(new Uint8Array(digest));
}
