import type { ParticipantRow } from './types';

/**
 * Constant-time string comparison. Avoids leaking match length/position via
 * timing. Both inputs are compared over a fixed number of iterations.
 */
export function constantTimeEqual(a: string, b: string): boolean {
	const aBytes = new TextEncoder().encode(a);
	const bBytes = new TextEncoder().encode(b);
	// Compare lengths in constant time too by folding length diff into result.
	let diff = aBytes.length ^ bBytes.length;
	const max = Math.max(aBytes.length, bBytes.length);
	for (let i = 0; i < max; i++) {
		diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	}
	return diff === 0;
}

/** Access codes are compared without case, spaces or dashes, so "k7pd-xq3m" matches. */
export const normalizeAccessCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function hashAccessCode(code: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeAccessCode(code)));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Credential policy. Real rosters carry a random access code per participant
 * (high entropy, so a plain SHA-256 is enough behind the login rate limit); the dev
 * roster has none and falls back to the roll number. Never logs the password.
 */
export async function validateParticipantCredentials(
	participant: ParticipantRow,
	password: string,
): Promise<boolean> {
	if (participant.accessCodeHash) {
		return constantTimeEqual(await hashAccessCode(password), participant.accessCodeHash);
	}
	return constantTimeEqual(password, String(participant.rollNumber));
}
