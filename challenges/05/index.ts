/**
 * Q5 — The Workshop
 *
 * The participant follows the Josiah Marrow lead from Q4 onto the wider web.
 * A search for Marrow's name surfaces one surviving resource: an abandoned
 * local-history website, "Pembridge Local Heritage", assembled by a retired
 * school librarian (E. Holt) around 2003–2008.
 *
 * The visible site mentions Marrow briefly but offers no workshop details.
 * The participant must check what the site tells automated crawlers to avoid —
 * the robots.txt file. Inside it, a disallowed path (with a BPHA- archival
 * prefix, explained in-world as a digitisation project tag) points to a page
 * that was removed from the site's navigation but never deleted.
 *
 * That hidden page is a full workshop article identifying the business name.
 *
 * Technique: robots.txt / hidden-path discovery (beginner-fair).
 * Participant flow:
 *   1. Arrive from Q4's Josiah Marrow lead.
 *   2. Explore the local-history site (at /{event}/archive/).
 *   3. Notice workshop details are absent from the site's navigation.
 *   4. Request /{event}/archive/robots.txt.
 *   5. Read the Disallow path: /BPHA-{archiveToken}-workshop/
 *   6. Navigate to /{event}/archive/BPHA-{archiveToken}-workshop/
 *   7. Read the workshop article; identify the business name.
 *   8. Submit "Ashwick Figureworks".
 *
 * Personalization: Yes — archiveToken (4-digit) varies per participant,
 *   making the BPHA path unique per participant. The canonical answer
 *   (ASHWICK FIGUREWORKS) is shared across all participants.
 *   Personalization is cosmetic anti-cheat only.
 *
 * Mutable: No.
 *
 * Q29 contribution: The BPHA- prefix in the robots.txt Disallow is the
 *   locked Q5 secondary anomaly. In-world reason: Bremwick-Pembridge Heritage
 *   Archive digitisation project (c. 2004), mundane at Q5. At Q29, this
 *   prefix is shown to recur across challenges in an impossible pattern.
 *
 * Connection → Q6: The workshop article references the Ashwick Trades
 *   Directory, where Marrow's client records were indexed with sequential
 *   identifiers beginning at D-001. That directory is the Q6 entry point.
 *
 * Answer: ASHWICK FIGUREWORKS (case-insensitive, exactMatch).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

/**
 * Structured public data for Q5.
 *
 * `archivePath` is in publicData because:
 *   - The challenge page shows the site URL context (/{event}/archive/).
 *   - The robots.txt and workshop page routes call getPublicChallengeData()
 *     to retrieve the participant's archivePath and validate access.
 *
 * The answer "ASHWICK FIGUREWORKS" lives only in privateData.
 */
export interface Q5Public {
	/** Anti-cheat session reference. Varies per participant. */
	sessionToken: string;
	/** 4-digit numeric token, e.g. "1847". Forms the BPHA path component. */
	archiveToken: string;
	/** Full archive path segment, e.g. "BPHA-1847-workshop". */
	archivePath: string;
}

const challenge: ChallengeModule<Q5Public, { answer: string }> = {
	metadata: {
		slot: 5,
		key: 'marrow-house',
		title: 'The Workshop',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: "Check what the Pembridge Local Heritage site tells automated crawlers not to visit — the robots.txt file may list paths excluded from the site's navigation.",
		},
		{
			order: 2,
			text: "Disallowed doesn't mean deleted. Request the path listed in the Disallow directive and read the page it returns.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q5Public, { answer: string }>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);
		// 4-digit archive token, range 1001–9998. Cosmetic anti-cheat variation.
		const tokenNum = await ctx.rng.int(1001, 9999);
		const archiveToken = String(tokenNum);
		const archivePath = `BPHA-${archiveToken}-workshop`;

		return {
			publicData: { sessionToken, archiveToken, archivePath },
			privateData: { answer: 'ASHWICK FIGUREWORKS' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
