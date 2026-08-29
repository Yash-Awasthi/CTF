/**
 * Q26 — Daniel Reyes, Again
 *
 * The Blackwood personnel archive contains more than one file with the name
 * "Daniel Reyes." Enumerating the archive surfaces four distinct records —
 * different photographs, different eras, same handwriting style metrics.
 * "Daniel Reyes" is not a person. It's a role. Fixed answer: 4.
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
		slot: 26,
		key: 'daniel-reyes-again',
		title: 'Daniel Reyes, Again',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'This is not the only personnel file with that name. Enumerate the archive directory — the name appears more than once.',
		},
		{
			order: 2,
			text: 'Count distinct records, not distinct mentions. Each record has a different photograph and a different era — but the handwriting metrics match across all of them.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'BLACKWOOD BUREAU — PERSONNEL ARCHIVE',
			'',
			'Search: name = \'Daniel Reyes\'',
			'',
			'--- RESULTS ---',
			'',
			'RECORD 1  ·  personnel/reyes-d-1952.pdf',
			'  Photo: male, approx. 35–45, monochrome, formal dress, early 1950s',
			'  Role: researcher, collection provenance — engaged 1952',
			'  Handwriting metrics: stroke angle 17°, loop ratio 0.44, slant rightward',
			'',
			'RECORD 2  ·  personnel/reyes-d-1968.pdf',
			'  Photo: male, approx. 30–40, colour (early), open collar, late 1960s',
			'  Role: provenance researcher — engaged 1968',
			'  Handwriting metrics: stroke angle 17°, loop ratio 0.44, slant rightward',
			'',
			'RECORD 3  ·  personnel/reyes-d-1963.pdf',
			'  Photo: male, approx. 30–40, matches photograph from Q25',
			'  Role: estate research contact — introduced 1963',
			'  Handwriting metrics: stroke angle 17°, loop ratio 0.44, slant rightward',
			'',
			'RECORD 4  ·  personnel/reyes-d-2015.pdf',
			'  Photo: male, approx. 30–40, digital, contemporary dress',
			'  Role: archive researcher — engaged 2015, Vale estate',
			'  Handwriting metrics: stroke angle 17°, loop ratio 0.44, slant rightward',
			'',
			'--- END RESULTS ---',
			'',
			'Same name. Same handwriting metrics. Decades apart.',
			'Each record is a distinct individual — yet they are indistinguishable.',
			'',
			'How many distinct \'Daniel Reyes\' records are in the personnel archive?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '4' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
