/**
 * Phase 16 static replay — personalization (build-plan locked design).
 *
 * Post-event, non-competitive, PUBLIC. Personalization derives ONLY from a
 * per-visitor `investigatorId` (random, localStorage) + a PUBLIC replay salt +
 * challenge slot, via SHA-256. It deliberately does NOT use EVENT_SECRET, HMAC
 * keys, participant seeds, or any live crypto — the salt is public and unrelated
 * to production secrets. Runs identically in the browser and in Node (Web Crypto
 * `crypto.subtle` exists in both), so the static client and any export tooling
 * agree.
 *
 * Answer checking is CLIENT-SIDE here and intentionally not tamper-proof — this
 * is archival replay, not competitive validation (that stays server-side, live).
 */

/** PUBLIC salt. Not a secret; unrelated to EVENT_SECRET. Bump to reshuffle. */
export const REPLAY_SALT = 'case-files-static-replay:v1';

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export interface ReplayPersonalization {
	/** A safe display token, stable per (investigatorId, slot). */
	token: string;
	/** The expected answer the visitor must enter (client-derived, non-secret). */
	expectedAnswer: string;
}

/** Deterministic per-visitor personalization for one slot. */
export async function replayPersonalize(
	investigatorId: string,
	slot: number,
): Promise<ReplayPersonalization> {
	if (!investigatorId) throw new Error('replayPersonalize: investigatorId required');
	if (!Number.isInteger(slot) || slot < 1) throw new Error('replayPersonalize: bad slot');
	const base = await sha256Hex(`${REPLAY_SALT}|${investigatorId}|${slot}`);
	return {
		token: base.slice(0, 8).toUpperCase(),
		expectedAnswer: `replay-${base.slice(8, 18)}`,
	};
}

/** Generate a fresh random investigatorId (browser CSPRNG). */
export function newInvestigatorId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
