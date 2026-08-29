/**
 * Q17 — The Dead Website
 *
 * The Vale collection archive website is marked "defunct." But checking the
 * HTTP response headers reveals a Last-Modified date well after Mira's 2015
 * disappearance — someone is still maintaining it. Fixed answer: 2023-09-14.
 *
 * Q29 contribution: none
 * Mutable: v2 of Q9's archive site — the site was "defunct" at Q9, now updated.
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
		slot: 17,
		key: 'the-dead-website',
		title: 'The Dead Website',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: '"Defunct" sites do not usually update themselves. Check when the page actually changed, not what it says on screen.',
		},
		{
			order: 2,
			text: 'The Last-Modified response header is set by the server, not the page content. It cannot be faked by the HTML. Check the raw HTTP headers.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'VALE ARCHIVE — EXTERNAL SITE REFERENCE',
			'',
			'An external site is referenced in the Case 71-C file index.',
			'',
			'  /case/archive/vale-estate',
			'',
			'The page says: \'This site has been archived. No updates since 2013.\'',
			'',
			'Mira Castellan disappeared in October 2015.',
			'',
			'A server always knows when it last modified a file.',
			'That information travels in the HTTP response headers —',
			'separate from anything the page itself claims.',
			'',
			'Check the response headers for that URL.',
			'(DevTools → Network tab, or: curl -I [url])',
			'',
			'What does the Last-Modified header say? (Format: YYYY-MM-DD)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '2023-09-14' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
