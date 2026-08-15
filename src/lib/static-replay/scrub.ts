/**
 * Privacy scrub for static export. Fails LOUDLY if prohibited live-event data
 * would ship in the public static output. Unmasked roll numbers are intentional
 * (locked decision) and NOT treated as a violation.
 */

export class PrivacyScrubError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PrivacyScrubError';
	}
}

/** Substrings that must never appear in static output (structural markers). */
export const FORBIDDEN_PATTERNS: readonly string[] = [
	'EVENT_SECRET',
	'ADMIN_SECRET',
	'RATE_LIMIT_SECRET',
	'token_hash',
	'tokenHash',
	'ip_hash',
	'ipHash',
	'session_token',
	'sessionToken',
	'ownershipMap',
	'ownership_map',
	'matched_participant',
	'matchedParticipantId',
	'anti_cheat',
	'antiCheat',
	'admin_actions',
	'privateData',
	'participantSeed',
	'challengeSeed',
	'attributionSeed',
	'dev-only', // dev secret values in .dev.vars all contain this marker
];

/**
 * Assert `content` contains none of the forbidden patterns nor any of the
 * provided secret VALUES. Throws PrivacyScrubError listing every hit.
 */
export function assertClean(
	content: string,
	secretValues: readonly string[] = [],
): void {
	const hits: string[] = [];
	for (const p of FORBIDDEN_PATTERNS) {
		if (content.includes(p)) hits.push(p);
	}
	for (const s of secretValues) {
		if (s && content.includes(s)) hits.push('<secret-value>');
	}
	if (hits.length > 0) {
		throw new PrivacyScrubError(`static export contains prohibited data: ${[...new Set(hits)].join(', ')}`);
	}
}
