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

interface Public {
	prompt: string;
	token: string;
}
interface Private {
	answer: string;
}

/** Archive document topic variants. Exported for test access. */
export const FILE_TOPICS: readonly string[] = [
	'vale-estate-inventory',
	'provenance-chain-notes',
	'collection-transfer-record',
	'acquisition-correspondence',
	'doll-catalogue-complete',
	'estate-appraisal-notes',
	'commission-ledger-partial',
	'owners-correspondence',
	'workshop-records-summary',
	'solicitor-instruction-file',
];

const challenge: ChallengeModule<Public, Private> = {
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
			text: 'Daniel gave you more than he realized — read his contact message carefully for details he reused.',
		},
		{
			order: 2,
			text: 'His portal password is the same string he used as a reference code in his introductory message. Check what he sent.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		// Derive a 6-char credential from RNG — Daniel reused this as his reference code
		const credChars = await ctx.rng.string(3, ALPHABETS.upper);
		const credNums = await ctx.rng.string(3, ALPHABETS.digits);
		const credential = `${credChars}${credNums}`;

		// Archive filename
		const topic = await ctx.rng.choice(FILE_TOPICS);
		const year = 2013 + (await ctx.rng.int(0, 3));
		const filename = `${topic}-${year}.pdf`;

		const prompt = [
			'DANIEL REYES — CONTACT RECEIVED',
			'',
			'A message arrived through the Blackwood routing system.',
			'No bureau registration. Unsolicited.',
			'',
			"--- MESSAGE ---",
			'"I have been assisting with the Vale estate provenance review since',
			'before Mira was contracted. I have files that may be relevant to your',
			`work. Reference code: ${credential}`,
			'(This is also the portal password — I keep it simple for quick access.)',
			'Please review the collection transfer documents."',
			'— D. REYES',
			'--- END MESSAGE ---',
			'',
			'He offered his own password without being asked.',
			'',
			'Archive contents — daniel-reyes-private-archive/:',
			`  ${filename}`,
			'  daniel-personal-notes-redacted.pdf',
			'  MEMO-draft-v1.html',
			'  MEMO-published.html',
			'',
			'What is the filename of the collection transfer document?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: filename },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
