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

/**
 * Credential policy for the current event: the expected password IS the roll
 * number. Isolated here so future events can change auth without touching the
 * session system. Never logs the submitted password.
 */
export function validateParticipantCredentials(
	participant: ParticipantRow,
	password: string,
): boolean {
	return constantTimeEqual(password, String(participant.rollNumber));
}
