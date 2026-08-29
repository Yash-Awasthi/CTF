/**
 * Q13 — The Redacted Owner
 *
 * Daniel's archive contains a PDF with a black rectangle "redacting" an owner
 * name — but the underlying text layer was never removed, only covered. Raw text
 * extraction recovers the name. Fixed answer: EDGAR HOLT.
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
		slot: 13,
		key: 'the-redacted-owner',
		title: 'The Redacted Owner',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: "Redaction boxes don't always remove the text underneath — sometimes they only hide it visually.",
		},
		{
			order: 2,
			text: 'Try extracting the raw text layer from the PDF. Tools like pdftotext or copy-paste from a PDF reader will pass through visually covered text.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'DANIEL\'S ARCHIVE — ITEM 1: OWNERSHIP DOCUMENT',
			'',
			'The first document in the archive. A property transfer, dated 1948.',
			'The ownership field has been obscured: ████████████████████████████',
			'',
			'Someone redacted it. Or tried to.',
			'',
			'Open the document: /case/pdf/ownership-transfer',
			'',
			'Visual redaction covers what the page renders.',
			'It does not cover what the page is built from.',
			'Inspect the page source — look for the TEXT LAYER block.',
			'',
			'Who was the 1948 owner?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'EDGAR HOLT' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
