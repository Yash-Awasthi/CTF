/**
 * Q21 — Access Granted
 *
 * The pattern of changing evidence motivates pivoting to access logs — harder
 * to alter. A SQL injection on a different endpoint (the audit log table, not
 * linked from the main UI) surfaces Daniel's elevated access timestamp, proving
 * he had administrative reach during the critical window.
 * Fixed answer: 2015-10-03 02:41
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
		slot: 21,
		key: 'access-granted',
		title: 'Access Granted',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Same technique as Q8, different table. The audit log is not linked from the main UI but the endpoint still accepts unsanitized input.',
		},
		{
			order: 2,
			text: "The audit table isn't in the primary namespace — try injecting ' UNION SELECT * FROM audit_log WHERE user='daniel.reyes' -- to surface it.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'VALE ARCHIVE PORTAL — SECONDARY SEARCH ENDPOINT',
			'',
			'Evidence has been altered. Someone with write access to the archive',
			'modified documents after Mira disappeared.',
			'',
			'The portal\'s primary search was accessible at Q8.',
			'A second endpoint was not linked from any visible page:',
			'',
			'  GET /api/search/records?q=[query]',
			'',
			'Run a search. Routine queries return only system maintenance logs.',
			'Elevated-access actions are recorded separately.',
			'',
			'The published memo was overwritten after Mira\'s disappearance.',
			'That write action was logged.',
			'',
			'Find the timestamp of the elevated write to MEMO-published.html.',
			'(Format: YYYY-MM-DD HH:MM)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '2015-10-03 02:41' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
