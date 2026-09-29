/**
 * Q10 — Doll Number Six
 *
 * The catalogue entry from Q9 includes photographs of the collection items.
 * Visual comparison of "Doll #6" against a missing-person photograph from the
 * 1978 case confirms the match — the item predates the subject by years.
 * Personalized: comparison detail varies (but answer is the doll number 6).
 *
 * Q29 contribution: the doll catalogue numbering skips sequence number 71
 *   (secondary anomaly — THE CONTINUITY's file numbering intrusion).
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
interface Private {
	answer: string;
}

/** Detail variant: the specific identifying feature that matches between doll and subject. */
const MATCH_DETAILS: readonly string[] = [
	'a crescent-shaped scar below the left eye',
	'an unusual asymmetric ear placement, left higher than right',
	'a distinctive curved posture of the right shoulder',
	'a triangular birthmark pattern on the left forearm (fabric representation)',
	'an extra-wide interpupillary distance reproduced in painted eyes',
	'a slight chin cleft rendered in the fired clay',
	'a notched left incisor reflected in the carved mouth detail',
	'a hairline running behind the left ear, identically shaped to the photo',
	'a collar-bone prominence sculpted with unusual anatomical precision',
	'a right-hand third finger shorter than the fourth — present in both',
];

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 10,
		key: 'doll-number-six',
		title: 'Doll Number Six',
		tier: 'medium',
		basePoints: 150,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Compare fine detail — clothing and damage are too general. Look for an anatomical feature specific enough to be beyond coincidence.',
		},
		{
			order: 2,
			text: 'One detail in the doll description is too precise to be generic craftsmanship. Cross-reference it with the missing-person photograph caption.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const matchDetail = await ctx.rng.choice(MATCH_DETAILS);

		const prompt = [
			'VALE COLLECTION — RESTRICTED PROVENANCE CATALOGUE',
			'',
			'The catalogue provenance section opened with the Q9 accession code.',
			'One entry stood out.',
			'',
			'The numbering sequence: 1, 2, 3, 4, 5, 6, 8, 9 ...',
			'Entry 7 does not exist. No annotation explains the gap.',
			'71 is the case number of this investigation.',
			'',
			'— DOLL CATALOGUE ENTRY —',
			'  Commission piece  ·  Catalogued: 1978-03-11',
			'  Medium: fired porcelain, full-figure, 30cm',
			`  Distinguishing feature: ${matchDetail}.`,
			'',
			'— 1978 MISSING-PERSON FILE (CYCLE 3 SUBJECT, UNNAMED) —',
			'  Photograph taken: 1978-01-22',
			`  Physical notation: ${matchDetail}.`,
			'',
			'The doll was catalogued in March 1978.',
			'The subject was photographed in January 1978.',
			'She disappeared five months later — June 1978.',
			'',
			'Which doll number matches the 1978 missing-person subject?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '6' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
