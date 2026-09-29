/**
 * Q27 — Stop Looking for People
 *
 * Mira's notebook v3: the final page. One sentence is legible; below it the ink is
 * gone. The Bureau's scanner kept what the ink lost: the "blank" line is made of
 * zero-width characters encoding her last words in binary, one kind of character
 * per bit value and a third separating letters. Fixed answer: FOLLOW THE NAMES.
 *
 * Personalized: which zero-width character means 0 and which means 1.
 * Q29 contribution: the hidden text ends with ROLES REMAIN, one doctrine line.
 * Mutable: v3 of Mira's notebook (v1 at Q3, v2 at Q20).
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

export const HIDDEN = 'Stop looking for people. Follow the names. Roles remain.';
const ZWSP = '​';
const ZWNJ = '‌';
export const SEPARATOR = '‍';

/** Each character as 8 bits (zero/one characters), letters separated by SEPARATOR. */
export function hide(text: string, zero: string, one: string): string {
	return [...text]
		.map((c) => c.charCodeAt(0).toString(2).padStart(8, '0').replace(/0/g, zero).replace(/1/g, one))
		.join(SEPARATOR);
}

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 27,
		key: 'stop-looking-for-people',
		title: 'Stop Looking for People',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The blank line is not blank. Copy it into anything that shows invisible Unicode characters and count what is there.',
		},
		{
			order: 2,
			text: 'Three zero-width characters appear: U+200B, U+200C and U+200D. U+200D separates letters; the other two are the bits 0 and 1 (try both ways). Each group of eight bits is one ASCII character.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const [zero, one] = (await ctx.rng.int(0, 2)) ? [ZWSP, ZWNJ] : [ZWNJ, ZWSP];
		const line = hide(HIDDEN, zero, one);

		const prompt = [
			'MIRA\'S NOTEBOOK — FINAL PAGE (FORENSICALLY RESTORED)',
			'',
			'The last page. One sentence survived. Below it, the ink is gone.',
			'',
			'--- NOTEBOOK FINAL PAGE ---',
			'',
			'The evidence changes. Daniel is not a person.',
			line,
			'',
			'--- END PAGE ---',
			'',
			'Scanner note: ink loss across the lower page. The scan station',
			'records pen pressure as well as ink. The second line of the page',
			`is ${[...line].length} characters long. None of them print.`,
			'',
			'What did Mira tell the next investigator to do?',
			'(Her instruction begins with FOLLOW.)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'FOLLOW THE NAMES' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer.replace(/\s+/g, ' ').replace(/\.$/, ''), instance.privateData.answer);
	},
};

export default challenge;
