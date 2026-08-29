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
			text: "Same name doesn't mean same file. Check if the content hash or file size has changed since you first accessed it.",
		},
		{
			order: 2,
			text: "Compare against what you read at Q15. One sentence in the published memo is different. That changed sentence is what you submit.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'DANIEL\'S ARCHIVE — MEMO FILE (RE-ACCESSED)',
			'',
			'After the voicemail, I returned to the memo.',
			'Same address. Different content.',
			'',
			'Current version: /case/memo/daniel-reyes-v2',
			'',
			'Compare it against what you read at Q15.',
			'The opening paragraph has been rewritten.',
			'The draft comment block from the earlier version — gone.',
			'',
			'Someone updated this file while this investigation was active.',
			'',
			'What is the first sentence of the current version\'s opening paragraph?',
			'(Submit the full sentence, exactly as written.)',
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
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
