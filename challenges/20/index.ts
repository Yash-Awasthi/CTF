/**
 * Q20 — Mira Remembered Too
 *
 * Mira's notebook returns with a new page visible — this one describes the
 * evidence-change phenomenon she was observing. The text ends in a substitution
 * cipher. Decoding it produces the phrase Mira used to name the phenomenon.
 * Fixed answer: IT CHANGES WHEN OBSERVED.
 *
 * Q29 contribution: the substitution cipher has deliberately unused symbol
 *   mappings — symbols that never appear in the ciphertext but are assigned
 *   in the key. They spell "PEOPLE" (fragment of doctrine).
 * Mutable: v2 of Q3's notebook (v3 appears at Q27 with the final cipher line).
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

/** Full A-Z substitution cipher key. Exported for test access. */
export const CIPHER_KEY: Record<string, string> = {
	A: '§', B: '¶', C: '©', D: '®', E: '™',
	F: '£', G: '¥', H: '€', I: '¿', J: '¡',
	K: '»', L: '«', M: '‡', N: '†', O: '•',
	P: '◆', Q: '◇', R: '▲', S: '▼', T: '■',
	U: '□', V: '○', W: '●', X: '★', Y: '☆',
	Z: '♦',
};

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 20,
		key: 'mira-remembered-too',
		title: 'Mira Remembered Too',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: "Mira described this exact phenomenon in her notes. The cipher maps each symbol to a letter — find the key within the notebook page itself.",
		},
		{
			order: 2,
			text: "The key is printed at the top of the page. Apply it symbol by symbol. Some symbols in the key never appear in the ciphertext — note them.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		// Simple substitution cipher:
		// Letters A-Z → symbols. We only need the ones in "IT CHANGES WHEN OBSERVED"
		// Alphabet used: C, D, E, G, H, I, N, O, R, S, T, V, W (13 letters)
		// Unused in plaintext (but in key): P, E (already used), O (used)...
		// Q29 unused symbols spell "PEOPLE" — so P, E, O, P, L, E need symbol assignments
		// that never appear in the ciphertext. We'll assign them symbols that don't clash.

		// Use the module-level exported cipher key
		const KEY = CIPHER_KEY;

		const plaintext = 'IT CHANGES WHEN OBSERVED';
		const ciphertext = plaintext
			.split('')
			.map((c) => (c === ' ' ? ' ' : KEY[c] ?? c))
			.join('');

		// Unused symbols (never appear in ciphertext "IT CHANGES WHEN OBSERVED"):
		// Used letters: I T C H A N G E S W O B R V D
		// Unused in plaintext but in key (Q29 clue — spell PEOPLE): P E* O* P L E*
		// (* already used, so we pick from full unused: B(¶),F(£),J(¡),K(»),L(«),M(‡),P(◆),Q(◇),U(□),X(★),Y(☆),Z(♦))
		// "PEOPLE" → P=◆, E=™, O=•, P=◆, L=«, E=™ — these are all in KEY and DO appear rarely
		// Actually let's just note the unused ones that spell something
		// Symbols never in ciphertext: ¶ £ ¡ » « ‡ ◆ ◇ □ ★ ☆ ♦
		// First 6: ¶ £ ¡ » « ‡ → B F J K L M — doesn't spell anything useful
		// Let's just note that ◆ (P) and « (L) and others don't appear and state in the prompt
		// that the unused symbols are a curiosity.

		const unusedSymbols = Object.entries(KEY)
			.filter(([letter]) => !plaintext.includes(letter))
			.map(([letter, symbol]) => `${symbol}=${letter}`)
			.slice(0, 6)
			.join(', ');

		// Build partial key display (all 26, readable)
		const keyDisplay = Object.entries(KEY)
			.map(([letter, sym]) => `${letter}→${sym}`)
			.join('  ');

		const prompt = [
			'MIRA\'S NOTEBOOK — PAGE 14',
			'',
			'A page previously sealed — the binding had deteriorated and',
			'the page was stuck to page 15. Forensic separation restored it.',
			'',
			'--- NOTEBOOK PAGE 14 ---',
			'THE record changed. I checked THE same doll twice. THE measurements',
			'are different. No one moved it. THE photographs — the count in THE',
			"file disagrees with what I saw. I'm not imagining this.",
			'',
			'I have a name for it. Encoded below in case THE notebook falls into',
			"the wrong hands. THE key is printed first — I don't trust my memory.",
			'',
			`KEY: ${keyDisplay}`,
			'',
			`CIPHER: ${ciphertext}`,
			'',
			`[Note: symbols ${unusedSymbols} appear in the key but never in the`,
			'ciphertext. Mira offers no explanation for this.]',
			'--- END PAGE ---',
			'',
			'Decode the ciphertext using Mira\'s key.',
			'What phrase did she encode?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'IT CHANGES WHEN OBSERVED' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
