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

		const prompt = [
			'BLACKWOOD BUREAU — CASE BOARD',
			'',
			'CASE 71-C — EVIDENCE SYNTHESIS',
			'',
			'MOTIVE:',
			'  Reyes knew Vale since 2001 (Q15 draft) — not 2013 as claimed.',
			'  Suppressing the true provenance (1948 ownership, pre-Vale acquisition',
			'  dates) protects a chain of fraudulent estate dealings.',
			'',
			'MEANS:',
			'  Elevated, unauthorised archive access confirmed by audit log (Q21).',
			'  Reyes could reach and alter records Mira could not.',
			'  MEMO-published.html was overwritten after her disappearance (Q19).',
			'',
			'OPPORTUNITY:',
			'  Building access log places Reyes at VALE ESTATE NORTH WING, 02:23–02:44',
			'  on 2015-10-03 — during the archive write window (Q22).',
			'  Transit records confirm he did not board the alibi coach.',
			'',
			'DIRECT EVIDENCE:',
			'  Mira\'s recovered audio names him — specifically \'what he is, not who\' (Q23).',
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
