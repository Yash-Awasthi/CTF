/**
 * Byte-level encoding helpers for the deterministic personalization engine.
 *
 * Everything cryptographic operates on `Uint8Array` seed material — hex/base64
 * conversion happens ONLY at the edges (tests, debug fingerprints, canonical
 * serialization). This module is the single place those conversions live so we
 * never scatter ad-hoc `.map(b => b.toString(16))` snippets across the codebase.
 */

const encoder = new TextEncoder();

/** UTF-8 encode a string to bytes. */
export function utf8(input: string): Uint8Array {
	return encoder.encode(input);
}

/** Hex-encode bytes (lowercase, no separator). */
export function toHex(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

/** Decode a lowercase/uppercase hex string to bytes. Rejects odd-length/invalid. */
export function fromHex(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) throw new Error('fromHex: odd-length hex string');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
		if (Number.isNaN(byte)) throw new Error('fromHex: invalid hex digit');
		out[i] = byte;
	}
	return out;
}

/** Encode an unsigned integer as 8 fixed big-endian bytes (u64). */
export function u64(value: number): Uint8Array {
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`u64: expected a non-negative integer, got ${value}`);
	}
	const out = new Uint8Array(8);
	let v = BigInt(value);
	for (let i = 7; i >= 0; i--) {
		out[i] = Number(v & 0xffn);
		v >>= 8n;
	}
	if (v !== 0n) throw new Error('u64: value exceeds 64 bits');
	return out;
}

/** Concatenate byte chunks into one buffer. */
export function concatBytes(chunks: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const c of chunks) total += c.length;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/**
 * Canonical, unambiguous framing of an ordered list of byte chunks.
 *
 * Each chunk is serialized as a 4-byte big-endian length prefix followed by the
 * chunk bytes, so `frame([utf8("ab"), utf8("c")])` can NEVER collide with
 * `frame([utf8("a"), utf8("bc")])`. This is what makes naive concatenation
 * (`eventSlug + rollNumber + challengeId`) impossible in this codebase.
 */
export function frame(chunks: Uint8Array[]): Uint8Array {
	const parts: Uint8Array[] = [];
	for (const chunk of chunks) {
		const len = new Uint8Array(4);
		let v = chunk.length;
		if (v > 0xffff_ffff) throw new Error('frame: chunk too large');
		for (let i = 3; i >= 0; i--) {
			len[i] = v & 0xff;
			v >>>= 8;
		}
		parts.push(len, chunk);
	}
	return concatBytes(parts);
}

/**
 * Short NON-reversible fingerprint of seed material for development-safe
 * diagnostics only. Truncated hash → cannot reconstruct the seed. NEVER log the
 * full seed; use this when you need to correlate two derivations in dev.
 */
export async function fingerprint(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return toHex(new Uint8Array(digest)).slice(0, 12);
}
