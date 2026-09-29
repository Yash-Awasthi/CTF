/**
 * Q20 — Mira Remembered Too
 *
 * A sealed page of Mira's notebook describes evidence changing between visits and
 * ends in a symbol cipher: the name she gave the phenomenon. Her key strip was torn
 * after M, so half the alphabet is missing; the rest falls out of the word shapes
 * (repeated symbols always hide the same letter). Fixed answer: IT CHANGES WHEN
 * OBSERVED.
 *
 * Personalized: the symbol assigned to each letter is shuffled per participant.
 * Q29 contribution: a second enciphered word in the margin decodes to PEOPLE,
 *   one doctrine noun.
 * Mutable: v2 of Q3's notebook (v3 appears at Q27).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q20Private {
	answer: string;
	/** Letter → symbol for all 26 letters. */
	key: Record<string, string>;
}

export const PLAINTEXT = 'IT CHANGES WHEN OBSERVED';
export const MARGIN = 'PEOPLE';
/** Letters on the surviving half of Mira's key strip. */
export const SURVIVING = 'ABCDEFGHIJKLM';
const SYMBOLS = ['§', '¶', '©', '®', '™', '£', '¥', '€', '¿', '¡', '»', '«', '‡', '†', '•', '◆', '◇', '▲', '▼', '■', '□', '○', '●', '★', '☆', '♦'];

export const encipher = (text: string, key: Record<string, string>) =>
	[...text].map((c) => (c === ' ' ? ' ' : key[c])).join('');

const challenge: ChallengeModule<Public, Q20Private> = {
	metadata: {
		slot: 20,
		key: 'mira-remembered-too',
		title: 'Mira Remembered Too',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Half the key survived. Decode every symbol you can, then treat the gaps as word shapes: the same missing symbol always hides the same letter.',
		},
		{
			order: 2,
			text: 'With A to M filled in, the line reads I_ CHA_GE_ _HE_ _B_E__ED. Mira was writing about evidence that behaves differently when someone looks at it.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q20Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const symbols = await ctx.rng.shuffle(SYMBOLS);
		const key = Object.fromEntries([...ALPHABETS.upper].map((l, i) => [l, symbols[i]]));
		const strip = [...SURVIVING].map((l) => `${l}→${key[l]}`).join('  ');

		const prompt = [
			'MIRA\'S NOTEBOOK — PAGE 14',
			'',
			'A page previously sealed — the binding had deteriorated and',
			'the page was stuck to page 15. Forensic separation restored it.',
			'',
			'--- NOTEBOOK PAGE 14 ---',
			'THE record changed. I checked THE same doll twice. THE measurements',
			'are different. No one moved it. THE photographs — the count in THE',
			"file disagrees with what I saw. I'm not imagining this.",
			'',
			'I have a name for it. Written in my own letters, in case THE',
			'notebook falls into the wrong hands. Key taped to the inside cover.',
			'',
			`${encipher(PLAINTEXT, key)}`,
			'',
			`In the margin, underlined twice:  ${encipher(MARGIN, key)}`,
			'--- END PAGE ---',
			'',
			'INSIDE COVER — key strip, torn after M:',
			`  ${strip}  ░░ torn ░░`,
			'',
			'What name did Mira give the phenomenon?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: PLAINTEXT, key },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer.replace(/\s+/g, ' '), instance.privateData.answer);
	},
};

export default challenge;
