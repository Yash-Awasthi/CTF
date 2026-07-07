/**
 * HMAC-SHA256 primitives via the Workers-compatible Web Crypto API.
 *
 * Two shapes are provided:
 *  - `hmac(keyBytes, data)` — one-shot, imports the key each call. Fine for the
 *    handful of derivation-hierarchy calls per request.
 *  - `importHmacKey` + `hmacWith` — import once, sign many times. The RNG uses
 *    this so a 200-block byte stream imports the challenge-seed key exactly once
 *    (see §33a: no key re-import in tight loops).
 */

/** Import raw key bytes as a non-extractable HMAC-SHA256 signing key. */
export async function importHmacKey(keyBytes: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		keyBytes as BufferSource,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
}

/** Sign `data` with an already-imported HMAC key → 32 raw bytes. */
export async function hmacWith(
	key: CryptoKey,
	data: Uint8Array,
): Promise<Uint8Array> {
	const sig = await crypto.subtle.sign('HMAC', key, data as BufferSource);
	return new Uint8Array(sig);
}

/** One-shot HMAC-SHA256(keyBytes, data) → 32 raw bytes. */
export async function hmac(
	keyBytes: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const key = await importHmacKey(keyBytes);
	return hmacWith(key, data);
}
