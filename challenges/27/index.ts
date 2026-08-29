/**
 * Q27 — Stop Looking for People
 *
 * Mira's notebook v3: the final page. Her last coherent note is a message with
 * deliberate spacing anomalies — extra spaces between words encoding a fragment
 * of the Q29 doctrine ("ROLES REMAIN"). The visible content is the instruction
 * Mira reached before she disappeared. Fixed answer: FOLLOW THE NAMES.
 *
 * Q29 contribution: spacing/formatting anomalies in the final message encode
 *   "ROLES REMAIN" (one space = 0, two spaces = 1, Morse-like).
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
			text: "The spacing between words in the final note is inconsistent. Some gaps are doubled. The gaps encode something, but the visible message is what you submit.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		// The spacing anomaly:
		// Single space = 0 (dot), Double space = 1 (dash)
		// Encoding "ROLES REMAIN" in Morse via word gaps.
		// Visible to careful readers — the prompt notes the anomaly explicitly.
		// Regular spacing shown as _ (single), anomalous as __ (double).

		// The final message with deliberate double-spaces at specific gaps:
		// "Stop  looking for  people. Follow  the  names."
		// Double gaps: Stop__looking (R), for__people (O), Follow__the (L), the__names (E)
		// We just show the raw note and note the spacing pattern.

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
			'Forensic note: the wide spacing is not degradation.',
			'Ink distribution confirms deliberate double-width gaps between certain words.',
			'The pattern encodes a secondary phrase: \'ROLES REMAIN\' —',
			'consistent with other fragments found in this case.',
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
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
