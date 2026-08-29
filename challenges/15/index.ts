/**
 * Q15 — Daniel's Explanation
 *
 * Daniel provides a memo explaining the impossible date anomaly from Q14.
 * Inspecting the HTML source reveals an earlier draft in a comment — the draft
 * contradicts the published version. The contradicting year is the answer.
 * Fixed answer: 2001 (the year Daniel claims in the hidden draft he knew Vale,
 * vs his published claim of first contact in "late 2013").
 *
 * Q29 contribution: none (mutation to Q19 is the continuity marker)
 * Mutable: v1 here (draft visible in source) — filename returns at Q19 with
 *   content changed (no comment, different sentence).
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
		slot: 15,
		key: 'the-memo',
		title: "Daniel's Explanation",
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The published memo was not the first draft. Look at the HTML source for evidence of earlier versions.',
		},
		{
			order: 2,
			text: 'HTML comment blocks are used to preserve draft text during revision. Find what was commented out before publishing.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'DANIEL\'S MEMO — PROVENANCE NOTE (PUBLISHED)',
			'',
			'In response to the ledger anomaly, Reyes submitted a provenance note.',
			'Published document: /case/memo/daniel-reyes',
			'',
			'Read it. The language is careful — too careful.',
			'His first message said he was involved before Mira arrived.',
			'The published memo says he was engaged by solicitors in late 2013.',
			'Mira was contracted in June 2015.',
			'',
			'Published documents sometimes carry remnants of earlier drafts.',
			'What the page displays is not always what the page contains.',
			'Inspect the page source.',
			'',
			'What year does the draft version claim Reyes first knew Silas Vale?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '2001' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
