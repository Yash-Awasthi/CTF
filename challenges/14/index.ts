/**
 * Q14 — Before Vale
 *
 * Vale's own acquisition ledger records Lot 47 in his private shorthand: every
 * digit shifted by an amount he never wrote down, with letters interleaved.
 * Trying every shift, exactly one gives a real date, and it predates Vale's birth.
 * Personalized: date (8) and shift (1-9) via RNG; every pair decodes uniquely
 * (checked in tests).
 *
 * Q29 contribution: the interleaved letters spell RECORDS, one doctrine noun.
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

/** Doctrine noun interleaved with the digits. */
export const NOISE = 'RECORDS';

/**
 * Shift every digit forward by `shift` (mod 10), drop the hyphens, interleave the
 * NOISE letters, then re-insert hyphens at the original digit positions.
 */
export function encodeDate(date: string, shift: number): string {
	const layer1 = date.replace(/\d/g, (c) => String((Number(c) + shift) % 10));
	const digits = layer1.replace(/-/g, '').split('');
	const pairs = digits.map((d, i) => d + (NOISE[i] ?? ''));
	let pos = 0;
	return layer1
		.split('-')
		.map((part) => pairs.slice(pos, (pos += part.length)).join(''))
		.join('-');
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
			text: 'Only the digits carry the date. Vale shifted them all by the same amount; there are only ten amounts to try, and only one gives a real calendar date from before he was born.',
		},
		{
			order: 2,
			text: 'Drop the letters (they spell a word; keep it for later). Subtract the same number from every digit, wrapping 0 back to 9, then put hyphens after the year and the month.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const date = await ctx.rng.choice(PRE_VALE_DATES);
		const shift = await ctx.rng.int(1, 10);
		const cipher = encodeDate(date, shift);

		const prompt = [
			'DANIEL\'S ARCHIVE — ITEM 2: VALE\'S ACQUISITION LEDGER',
			'',
			'Vale wrote this entry in his private shorthand. It is not damage.',
			'',
			'--- LEDGER, PAGE 31 ---',
			'  Lot 47  ·  Untitled figure (commission)',
			`  Acquired:  ${cipher}`,
			'  Ref:       MRW-COLLECTION-SERIES-A',
			'--- END ---',
			'',
			'Pencilled inside the cover, in Vale\'s hand:',
			'  "Dates: digits only. Every digit pushed forward by the same amount,',
			'   nine wrapping round to nought. The amount I keep in my head."',
			'',
			'Vale was born in the 1940s. His purchase records begin in 1992.',
			'',
			'When does his own ledger say he acquired Lot 47? (Format: YYYY-MM-DD)',
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
