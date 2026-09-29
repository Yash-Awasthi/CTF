/**
 * Q15 — Daniel's Explanation
 *
 * Daniel provides a memo explaining the impossible date anomaly from Q14.
 * Inspecting the HTML source reveals an earlier draft in a comment — the draft
 * contradicts the published version: it dates his first meeting with Vale to 2001,
 * not "late 2013". The meeting date in the draft is the answer.
 *
 * Attribution-enabled: each participant's draft names a different day of 2001, so a
 * shared answer identifies its owner. The year stays 2001 for Q24.
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
		attributionEnabled: true,
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
			'On what date does the draft say Reyes first met Silas Vale? (YYYY-MM-DD)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: ctx.attributionAnswer! },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	getAttributionPool() {
		const out: string[] = [];
		for (let t = Date.UTC(2001, 0, 1); t < Date.UTC(2002, 0, 1); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
		return out;
	},
};

export default challenge;
