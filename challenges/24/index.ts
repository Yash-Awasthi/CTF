/**
 * Q24 — Case Closed
 *
 * All evidence threads converge: motive (protecting the 2001 connection),
 * means (elevated access, Q21), opportunity (Q22 alibi broken), and Mira's
 * named fear (Q23). The participant synthesizes and closes the case — wrongly,
 * as Q25–27 will reveal. Peak false resolution. Fixed: DANIEL REYES.
 *
 * Q29 contribution: none
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

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 24,
		key: 'case-closed',
		title: 'Case Closed',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Everything you have points one way. No new evidence is needed — review what you have gathered.',
		},
		{
			order: 2,
			text: 'Motive, means, opportunity, and direct evidence all converge on the same name. Submit the full name of the person responsible.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		// The board quotes this player's own findings, so it reads as their case.
		const found = async (slot: number) => ((await ctx.related(slot)).privateData as { answer: string }).answer;
		const [met, room, box] = [await found(15), await found(22), await found(23)];

		const prompt = [
			'BLACKWOOD BUREAU — CASE BOARD',
			'',
			'CASE 71-C — EVIDENCE SYNTHESIS',
			'',
			'MOTIVE:',
			`  Reyes met Vale on ${met} (Q15 draft), not in late 2013 as he claimed.`,
			'  Hiding the true provenance (the 1948 owner, the pre-Vale ledger date)',
			'  protects whatever the collection really is.',
			'',
			'MEANS:',
			'  Elevated, unauthorised archive access confirmed by the audit log (Q21).',
			'  He could reach and alter records Mira could not.',
			'  MEMO-published.html was overwritten after her disappearance (Q19).',
			'',
			'OPPORTUNITY:',
			`  His replacement card puts him in the ${room} across the 02:41 write`,
			'  on 2015-10-03 (Q22). He never boarded the coach.',
			'',
			'DIRECT EVIDENCE:',
			`  Mira wrote his name into her own tape, beside box ${box} (Q23).`,
			'  "Afraid of what he is. Not who. What."',
			'',
			'Four independent threads. One name.',
			'',
			'Who is responsible for Mira Castellan\'s disappearance? (Submit full name.)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'DANIEL REYES' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
