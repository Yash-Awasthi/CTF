/**
 * Q27 — Stop Looking for People
 *
 * Mira's notebook v3: the final page, written with every gap double-width, plus a
 * margin note. The visible instruction is the answer. Fixed answer: FOLLOW THE NAMES.
 *
 * Q29 contribution: the margin note "ROLES REMAIN".
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
			text: 'Mira already solved this part. Look at structure, not just content — she was methodical even at the end.',
		},
		{
			order: 2,
			text: "The margin note belongs to Q29. Here, submit the instruction itself: the sentence that starts with FOLLOW.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'MIRA\'S NOTEBOOK — FINAL PAGE (FORENSICALLY RESTORED)',
			'',
			'The last page. Previously unreadable. Partial restoration achieved.',
			'This is Mira\'s final coherent entry.',
			'',
			'--- NOTEBOOK FINAL PAGE ---',
			'',
			'The  evidence  changes.  Daniel  is  not  a  person.',
			'Stop  looking  for  people.  Follow  the  names.',
			'',
			'[remaining text: ink completely gone — unrecoverable]',
			'--- END PAGE ---',
			'',
			'Forensic note: the wide spacing is not degradation. Every gap was',
			'written double-width, slowly, as if she was being careful.',
			'A margin note in the same ink reads: \'ROLES REMAIN\'.',
			'',
			'The visible instruction is what matters here.',
			'What does Mira\'s final note tell the investigator to do?',
			'(Submit the second sentence, starting with FOLLOW.)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'FOLLOW THE NAMES' },
		};
	},

	validate(instance, normalizedAnswer) {
		// The note is printed with double spaces and a full stop; a pasted copy must pass.
		return exactMatch(normalizedAnswer.replace(/\s+/g, ' ').replace(/\.$/, ''), instance.privateData.answer);
	},
};

export default challenge;
