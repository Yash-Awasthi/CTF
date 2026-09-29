/**
 * Q19 — The Same File
 *
 * The voicemail from Q18 prompts a re-check of Daniel's archive. The file
 * MEMO-published.html now has different content from what was retrieved at Q15 —
 * same filename, different hash, one sentence altered. Fixed answer: the changed
 * sentence (the new version now omits Daniel's "engaged by solicitors" claim
 * and instead says he has "no direct knowledge of the acquisition timeline").
 *
 * Q29 contribution: none
 * Mutable: v2 of Q15's MEMO-published.html.
 */
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
		slot: 19,
		key: 'the-same-file',
		title: 'The Same File',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Your Q15 page still quotes what the published memo used to claim about when he was engaged. Find where the memo made that claim.',
		},
		{
			order: 2,
			text: 'The opening paragraph was rewritten. Submit its new first sentence.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			"DANIEL'S ARCHIVE — MEMO FILE (RE-ACCESSED)",
			'',
			'After the voicemail, you open the memo again.',
			'Same address:  /case/memo/daniel-reyes',
			'',
			'The file has not been renamed. Nobody has told you it changed.',
			'Your Q15 notes record what the published memo claimed then.',
			'',
			'One sentence of the published text now says something else.',
			'Submit the sentence that replaced it, exactly as it now reads.',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: {
				answer:
					'I have no direct knowledge of the acquisition timeline prior to the estate sale process.',
			},
		};
	},

	validate(instance, normalizedAnswer) {
		// Copied from the page the sentence may carry a line break; the full stop is optional.
		const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\.$/, '').toLowerCase();
		return { correct: clean(normalizedAnswer) === clean(instance.privateData.answer) };
	},
};

export default challenge;
