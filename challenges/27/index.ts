/**
 * Q27 — Stop Looking for People
 *
 * Mira's notebook v3: the final page. One sentence is legible. The Bureau's scanner
 * kept what the ink lost: invisible characters threaded through that sentence carry
 * her last words. Four zero-width characters each stand for two bits (most
 * significant first, four per ASCII byte); which stands for which is personal. A
 * fifth, U+FEFF, is scanner noise and carries nothing.
 *
 * Her last words name a folio of the Ledger. The folio is the answer, unique per
 * player (attribution-enabled), and is where Q28 opens.
 *
 * Personalized: the symbol-to-bits mapping, noise positions and the folio.
 * Q29 contribution: the hidden text ends with ROLES REMAIN, one doctrine line.
 * Mutable: v3 of Mira's notebook (v1 at Q3, v2 at Q20).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q27Private {
	answer: string;
}

export const VISIBLE = 'The evidence changes. Daniel is not a person.';
export const hiddenText = (folio: string) => `Stop looking for people. Follow the names. Ledger folio ${folio}. Roles remain.`;
/** The four data symbols; a player's permutation of them encodes 00, 01, 10, 11. */
export const SYMBOLS = ['​', '‌', '‍', '⁠'];
export const NOISE = '﻿';

/** Text as base-4 symbols, four per byte, most significant pair first. */
export function hide(text: string, digits: readonly string[]): string {
	return [...text].map((c) => {
		const b = c.charCodeAt(0);
		return [6, 4, 2, 0].map((s) => digits[(b >> s) & 3]).join('');
	}).join('');
}

const challenge: ChallengeModule<Public, Q27Private> = {
	metadata: {
		slot: 27,
		key: 'stop-looking-for-people',
		title: 'Stop Looking for People',
		tier: 'hard',
		basePoints: 450,
		attributionEnabled: true,
	},
	hints: [
		{
			order: 1,
			text: 'The surviving sentence is longer than it looks. Paste it into anything that shows code points, and count how many different invisible characters there are and how often each appears.',
		},
		{
			order: 2,
			text: 'One invisible character is scanner noise. The other four are digits in base four; there are only 24 ways to assign them, and only one turns every group of four into printable ASCII.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q27Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const folio = ctx.attributionAnswer!;
		const digits = await ctx.rng.shuffle([...SYMBOLS]);
		const payload = [...hide(hiddenText(folio), digits)];
		for (let i = 0; i < 9; i++) payload.splice(await ctx.rng.int(0, payload.length + 1), 0, NOISE);

		// Thread the invisible run through the visible sentence, a slice after each letter.
		const visible = [...VISIBLE];
		const per = Math.ceil(payload.length / visible.length);
		const line = visible.map((c, i) => c + payload.slice(i * per, (i + 1) * per).join('')).join('');

		const prompt = [
			'MIRA\'S NOTEBOOK — FINAL PAGE (FORENSICALLY RESTORED)',
			'',
			'The last page. One sentence survived. Below it, the ink is gone.',
			'',
			'--- NOTEBOOK FINAL PAGE ---',
			'',
			line,
			'',
			'--- END PAGE ---',
			'',
			'Scanner note: ink loss across the lower page. The scan station',
			'records pen pressure as well as ink.',
			'',
			'Mira left the next investigator a reference. What is it?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: folio },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer.replace(/^(ledger\s+)?folio\s+/, '').replace(/\.$/, ''), instance.privateData.answer);
	},

	getAttributionPool() {
		// 1,000 four-digit folios covers the 195-player cap.
		return Array.from({ length: 1000 }, (_, i) => String(1000 + i * 9));
	},
};

export default challenge;
