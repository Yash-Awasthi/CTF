/**
 * Q29 — The Continuity
 *
 * A Blackwood evidence-correlation terminal presents all ten secondary anomalies
 * gathered throughout the investigation (Q3, Q5, Q6, Q10, Q14, Q18, Q20, Q25,
 * Q27, Q28). Assembling them produces the five-line doctrine. The terminal asks
 * the participant to name the system responsible for maintaining the Ledger.
 * Fixed answer: THE CONTINUITY.
 *
 * Q29 contribution: this challenge IS the synthesis — it resolves all prior
 *   secondary anomalies.
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
		slot: 29,
		key: 'the-continuity',
		title: 'Anomaly Synthesis',
		tier: 'hard',
		basePoints: 350,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Ten small things you probably dismissed. Bring them together: the "THE" underlines, the TC- prefix, the .cts extension, the skipped 71, the leftover cipher chars, the voicemail tone, the cipher phrase, the archival mark, the spacing pattern, and the marginal doctrine fragments.',
		},
		{
			order: 2,
			text: 'Assemble the doctrine from the fragments before naming the system. The name does not appear in the doctrine text — infer it from what the doctrine describes.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'BLACKWOOD — EVIDENCE CORRELATION TERMINAL',
			'[RESTRICTED ACCESS — SENIOR INVESTIGATOR ONLY]',
			'',
			'Ten anomalies were flagged during this investigation.',
			'They did not appear to be part of the primary evidence chain.',
			'Cross-reference them.',
			'',
			'--- SECONDARY ANOMALY BOARD ---',
			'',
			'[Q3]  Mira underlined \'THE\' every time she wrote it.',
			'      Not random emphasis.',
			'',
			'[Q5]  The blocked robots.txt path carried an unexplained prefix: TC-',
			'      This is not a Blackwood Bureau standard. Source unknown.',
			'',
			'[Q6]  The suppressed directory entry had file extension: .cts',
			'      No registered format. No explanation.',
			'',
			'[Q10] The 1978 missing-persons register skipped entry 071 — no annotation.',
			'      71 is the case number of this investigation.',
			'',
			'[Q14] The ledger cipher contained unused decoded characters.',
			'      Extracted, they form a word.',
			'',
			'[Q18] The voicemail\'s quiet 440Hz carrier was keyed in Morse:',
			'      TC, repeating under the message.',
			'',
			'[Q20] Mira\'s cipher phrase: IT CHANGES WHEN OBSERVED.',
			'      She meant the records, not the people.',
			'',
			'[Q25] Photograph reverse: archival stamp TC-III-S',
			'      Not a Blackwood format. TC = unknown. III = a cycle number.',
			'',
			'[Q27] Mira\'s final page carried a margin note: ROLES REMAIN.',
			'      Same ink as the note itself.',
			'',
			'[Q28] Ledger marginal doctrine fragments:',
			"      'PEOPLE CHANGE. [REDACTED]. RECORDS CHANGE. [REDACTED].",
			"       THE INVESTIGATION MUST CONTINUE.'",
			'',
			'--- TERMINAL ---',
			'TC recurs in every anomaly that references an external organisation.',
			'The Ledger predates Blackwood Bureau by decades.',
			'Something else has been maintaining these records.',
			'',
			'Identify the system responsible for maintaining the Ledger.',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'THE CONTINUITY' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
