/**
 * Q14 — Before Vale
 *
 * A ledger scan recovered from Daniel's archive contains an acquisition date
 * encoded in a two-pass cipher (Caesar shift then base-64-style substitution).
 * Decoding proves the collection existed before Vale's confirmed birth year.
 * Personalized: eight different pre-Vale dates via RNG. Leftover decoded
 * characters are a Q29 secondary anomaly.
 *
 * Q29 contribution: cipher has deliberately unused decoded characters that
 *   spell a fragment of THE CONTINUITY doctrine.
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

/** Pre-Vale acquisition dates. Vale born ~1940s, so anything before 1935 qualifies. Exported for test access. */
export const PRE_VALE_DATES: readonly string[] = [
	'1923-08-19',
	'1931-05-04',
	'1917-11-27',
	'1929-03-16',
	'1935-07-08',
	'1928-12-01',
	'1922-04-22',
	'1934-09-30',
];

/**
 * Encode a date string via a two-layer cipher.
 * Layer 1: each digit D → (D + 3) mod 10 (digit Caesar)
 * Layer 2: interleave with RECORDS noise chars (Q29 leftover).
 * Exported for test access.
 */
export function encodeDate(date: string): { cipher: string; leftover: string } {
	// Layer 1: digit shift +3 mod 10, hyphens preserved
	const layer1 = date
		.split('')
		.map((c) => (/\d/.test(c) ? String((parseInt(c) + 3) % 10) : c))
		.join('');

	// Layer 2: interleave with noise characters (Q29 leftover)
	// Noise chars spell "RECORDS" (fragment of doctrine "RECORDS CHANGE")
	const noiseChars = 'RECORDS'.split('');
	const digits = layer1.replace(/-/g, '').split('');
	const interleaved: string[] = [];
	for (let i = 0; i < digits.length; i++) {
		interleaved.push(digits[i]);
		if (i < noiseChars.length) interleaved.push(noiseChars[i]);
	}
	// Reconstruct with hyphens at original positions
	const parts = layer1.split('-');
	const cipherParts: string[] = [];
	let pos = 0;
	for (const part of parts) {
		let cipherPart = '';
		for (let i = 0; i < part.length; i++) {
			cipherPart += interleaved[pos * 2];
			cipherPart += interleaved[pos * 2 + 1] ?? '';
			pos++;
		}
		cipherParts.push(cipherPart);
	}
	const cipher = cipherParts.join('-');
	const leftover = noiseChars.join('');
	return { cipher, leftover };
}

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 14,
		key: 'before-vale',
		title: 'Before Vale',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: "It's encoded, not random — look for a digit-shift pattern first, then deal with the interleaved characters.",
		},
		{
			order: 2,
			text: 'Two passes: first extract only the numeric characters (drop the interspersed letters), then reverse a digit shift of +3.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const date = await ctx.rng.choice(PRE_VALE_DATES);
		const { cipher, leftover } = encodeDate(date);

		const prompt = [
			'DANIEL\'S ARCHIVE — ITEM 2: ACQUISITION LEDGER',
			'',
			'A ledger page. The encoding is deliberate — not degradation.',
			'',
			'--- CIPHER BLOCK ---',
			`ACQUISITION DATE (ENCODED): ${cipher}`,
			'RECORD IDENTIFIER: MRW-COLLECTION-SERIES-A',
			'--- END BLOCK ---',
			'',
			`Interspersed non-digit characters: ${leftover}`,
			'They do not encode anything. Their purpose is unclear.',
			'',
			'Vale\'s own notation, found alongside the ledger:',
			'  \'Extract only digit characters. Each was shifted forward by 3',
			'  (mod 10) — reverse the shift. Re-insert hyphens at positions 4 and 7.\'',
			'',
			'What is the decoded acquisition date? (Format: YYYY-MM-DD)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: date },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
