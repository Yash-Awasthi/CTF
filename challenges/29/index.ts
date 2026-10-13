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
 * initials it is signed with and a countersign enciphered (Vigenère) under the
 * keeper's full name. Naming the system is the key; the countersign in clear is
 * the answer, unique per player (attribution-enabled).
 * Mutable: no
 */
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q29Private {
	answer: string;
}

export const DOCTRINE = ['PEOPLE CHANGE', 'NAMES REMAIN', 'RECORDS CHANGE', 'ROLES REMAIN', 'THE INVESTIGATION MUST CONTINUE'];
export const KEEPER = 'THE CONTINUITY';
const WORDS = ['ARCHIVE', 'CINDER', 'LANTERN', 'HOLLOW', 'VESTIGE', 'LACUNA', 'REMNANT', 'THRESHOLD', 'RELIQUARY', 'SEXTANT', 'CAIRN', 'BASTION', 'FALLOW', 'INKWELL', 'DREDGE', 'WANDERER'];

/** True when text holds the five doctrine lines, in any order and any punctuation. */
export function isDoctrine(text: string): boolean {
	const lines = text.toUpperCase().split(/[.\n;]+/).map((l) => l.replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
	return lines.length === DOCTRINE.length && DOCTRINE.every((d) => lines.includes(d));
}

/** Vigenère over A–Z (other characters pass through, key advances on letters only). */
export function vigenere(text: string, key: string, decrypt = false): string {
	const k = key.replace(/[^A-Z]/g, '');
	let i = 0;
	return text.replace(/[A-Z]/g, (c) => {
		const shift = (k.charCodeAt(i++ % k.length) - 65) * (decrypt ? -1 : 1);
		return String.fromCharCode(((c.charCodeAt(0) - 65 + shift + 26) % 26) + 65);
	});
}

const challenge: ChallengeModule<Public, Q29Private> = {
	metadata: {
		slot: 29,
		key: 'the-continuity',
		title: 'Anomaly Synthesis',
		tier: 'hard',
		basePoints: 550,
		attributionEnabled: true,
	},
	hints: [
		{
			order: 1,
			text: 'Solved pages stay open. Four of the ten fill the burned nouns in the Ledger note; the doctrine has five lines, and the terminal checks all five.',
		},
		{
			order: 2,
			text: 'The countersign is a Vigenère cipher keyed with the keeper\'s full name, letters only. The initials, the TC prefix on the robots.txt path and the photograph stamp, and the word Mira underlined give you that name.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q29Private>> {
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
			'Command available:  VERIFY <doctrine>',
			'',
			'Whoever keeps the Ledger countersigns every doctrine it verifies.',
			'Submit the countersign in clear.',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: ctx.attributionAnswer! },
		};
	},

	validate(instance, normalizedAnswer) {
		const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
		return { correct: clean(normalizedAnswer) === clean(instance.privateData.answer) };
	},

	getAttributionPool() {
		// 1,000 countersigns covers the 195-player cap; the number alone keeps them unique.
		return Array.from({ length: 1000 }, (_, i) => `${WORDS[(i * 7) % WORDS.length]}-${String(1000 + i * 9)}`);
	},
};

export default challenge;
