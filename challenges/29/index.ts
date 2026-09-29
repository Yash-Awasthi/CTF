/**
 * Q29 — Anomaly Synthesis (the meta)
 *
 * The correlation board points at ten details set aside during the case but does
 * not repeat them; players go back to the solved pages and recover them:
 *   Q14 RECORDS · Q18 NAMES REMAIN · Q20 PEOPLE · Q27 ROLES REMAIN restore the
 *   burned nouns of Q28's marginal doctrine;
 *   Q3 THE · Q5 TC- path · Q6 .cts · Q10 missing entry 071 · Q25 TC-III-W point
 *   at who keeps it.
 * A terminal command checks a reconstructed doctrine and, when right, shows the
 * initials it is signed with. The answer is the name those initials stand for.
 * Fixed answer: THE CONTINUITY.
 * Mutable: no
 */
import { oneOf } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
interface Private {
	answer: string;
}

export const DOCTRINE = ['PEOPLE CHANGE', 'NAMES REMAIN', 'RECORDS CHANGE', 'ROLES REMAIN', 'THE INVESTIGATION MUST CONTINUE'];

/** True when text holds the five doctrine lines, in any order and any punctuation. */
export function isDoctrine(text: string): boolean {
	const lines = text.toUpperCase().split(/[.\n;]+/).map((l) => l.replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
	return lines.length === DOCTRINE.length && DOCTRINE.every((d) => lines.includes(d));
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
			text: 'Solved pages stay open. Go back: Vale\'s cipher letters, the voicemail\'s quiet tone, Mira\'s margin word and her blank line fill the four burned nouns in the Ledger note.',
		},
		{
			order: 2,
			text: 'Verify the doctrine at the terminal to see its initials. The same two letters prefix the hidden robots.txt path and stamp the photograph; Mira underlined the first word of the name every time she wrote it.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'BLACKWOOD — EVIDENCE CORRELATION TERMINAL',
			'[RESTRICTED ACCESS — SENIOR INVESTIGATOR ONLY]',
			'',
			'Ten details were flagged during this investigation and set aside.',
			'None was part of the evidence chain. All are still where you found them.',
			'',
			'--- SECONDARY ANOMALY BOARD ---',
			'[Q3]  A word Mira marked every time she wrote it.',
			'[Q5]  A path the heritage site hid from crawlers. Not a BPHA path.',
			'[Q6]  A document format no archive registers.',
			'[Q10] A register entry that is missing, and its number.',
			'[Q14] The letters Vale\'s cipher did not need.',
			'[Q18] What the quiet tone under the voicemail spelled.',
			'[Q20] The word in Mira\'s margin.',
			'[Q25] The stamp on the back of the photograph.',
			'[Q27] What the blank line said after her instruction.',
			'[Q28] The doctrine in the Ledger\'s margin, its nouns burned out.',
			'',
			'--- TERMINAL ---',
			'Four of these restore the doctrine. The rest point at who keeps it.',
			'Command available:  VERIFY <doctrine>',
			'',
			'Identify the system responsible for maintaining the Ledger.',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'THE CONTINUITY' },
		};
	},

	validate(instance, normalizedAnswer) {
		return oneOf(normalizedAnswer.replace(/\s+/g, ' '), [instance.privateData.answer, 'CONTINUITY']);
	},
};

export default challenge;
