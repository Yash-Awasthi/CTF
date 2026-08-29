/**
 * Q30 — The Subject
 *
 * The final terminal. After Q29, the interface strips Blackwood branding and
 * presents a THE CONTINUITY shell. The prompt shows the Cycle 6 row with
 * SUCCESSOR: PENDING. The final query asks: "IDENTIFY THE SUBJECT."
 *
 * The answer is the participant's own investigator codename — assigned silently
 * at Q1, never emphasized, visible only in small UI chrome throughout the event.
 * The codename is derived deterministically from rollNumber (same formula as Q1).
 *
 * NOT attribution-enabled: the codename is derived from getCodename(rollNumber),
 * not from the attribution engine. This guarantees Q1 and Q30 give the same
 * answer without depending on the attribution bijection.
 *
 * Q29 contribution: none (this IS the payoff)
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import { getCodename } from '../shared/codenames';
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
		slot: 30,
		key: 'the-subject',
		title: 'The Subject',
		tier: 'capstone',
		basePoints: 500,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'You were told this before the game began. It has been visible throughout — not in the case files, but in the interface.',
		},
		{
			order: 2,
			text: 'Not a person you investigated. Someone you are. Your investigator codename, assigned at Q1.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const codename = getCodename(ctx.rollNumber);

		const prompt = [
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'  THE CONTINUITY',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'',
			'CONTINUITY RECORD: CURRENT',
			'',
			'  COLLECTOR    : COMPLETE',
			'  SUBJECT      : COMPLETE',
			'  INVESTIGATOR : COMPLETE',
			'  WITNESS      : COMPLETE',
			'  SUCCESSOR    : PENDING',
			'',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'',
			'FINAL QUERY',
			'',
			'IDENTIFY THE SUBJECT.',
			'',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: codename },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
