/**
 * Q12 — Daniel Reyes
 *
 * The previous owner from Q11 is only reachable through Daniel Reyes's private
 * archive portal. The portal uses weak/reused credentials — Daniel's own contact
 * message reveals them. Once in, the archive listing shows the relevant filename.
 * Personalized: archive filename derived from RNG.
 *
 * Q29 contribution: none
 * Mutable: filename returns as Q19 with altered content.
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

export interface Q12Public {
	prompt: string;
	token: string;
}
/** `listing` and `credential` are served only by the portal route after a correct password. */
export interface Q12Private {
	answer: string;
	credential: string;
	listing: string[];
}

/** Distractor document topics in Daniel's archive. Exported for test access. */
export const FILE_TOPICS: readonly string[] = [
	'vale-estate-inventory',
	'provenance-chain-notes',
	'acquisition-correspondence',
	'doll-catalogue-complete',
	'estate-appraisal-notes',
	'commission-ledger-partial',
	'owners-correspondence',
	'workshop-records-summary',
	'solicitor-instruction-file',
];

const challenge: ChallengeModule<Q12Public, Q12Private> = {
	metadata: {
		slot: 12,
		key: 'daniel-reyes',
		title: 'Daniel Reyes',
		tier: 'medium',
		basePoints: 150,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Daniel says the password is in his subject line. The relay shows mail exactly as it travelled, headers included.',
		},
		{
			order: 2,
			text: 'A header of the form =?UTF-8?B?…?= is an RFC 2047 encoded word: the part between the last two question marks is base64.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q12Public, Q12Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		// Derive a 6-char credential from RNG — Daniel reused this as his reference code
		const credChars = await ctx.rng.string(3, ALPHABETS.upper);
		const credNums = await ctx.rng.string(3, ALPHABETS.digits);
		const credential = `${credChars}${credNums}`;

		// The transfer record carries a per-participant serial; the rest are distractors.
		const year = 2013 + (await ctx.rng.int(0, 2));
		const serial = await ctx.rng.string(3, ALPHABETS.digits);
		const filename = `collection-transfer-${year}-${serial}.pdf`;
		const others: string[] = [];
		for (const t of await ctx.rng.sample(FILE_TOPICS, 3)) others.push(`${t}-${2013 + (await ctx.rng.int(0, 2))}.pdf`);
		const listing = await ctx.rng.shuffle([
			filename,
			...others,
			'daniel-personal-notes-redacted.pdf',
			'MEMO-draft-v1.html',
			'MEMO-published.html',
		]);

		const subject = btoa(`Vale estate review — ref ${credential}`.replace(/—/g, '-'));
		const prompt = [
			'DANIEL REYES — CONTACT RECEIVED',
			'',
			'A message arrived through the Blackwood routing system.',
			'No bureau registration. Unsolicited. Shown as relayed.',
			'',
			"--- MESSAGE ---",
			'From: "D. Reyes" <d.reyes@vale-provenance.org>',
			'To: case-71c@blackwood-bureau.org',
			`Subject: =?UTF-8?B?${subject}?=`,
			'X-Relay: blackwood-relay-3; spf=none',
			'',
			'"I have been assisting with the Vale estate provenance review since',
			'before Mira was contracted. My private archive portal is linked below.',
			'The password is the reference in my subject line.',
			'Please review the collection transfer document first."',
			'— D. REYES',
			'--- END MESSAGE ---',
			'',
			'What is the filename of the collection transfer document?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: filename, credential, listing },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
