/**
 * Q17 — The Dead Website
 *
 * The Vale collection archive website is marked "defunct." But checking the
 * HTTP response headers reveals a Last-Modified date well after Mira's 2015
 * disappearance — someone is still maintaining it.
 *
 * Attribution-enabled: each participant's Last-Modified date is a unique day in
 * 2016–2024, so a shared answer identifies its owner.
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

/** Every day from 2016-01-01 to 2024-12-31, all after Mira's disappearance. */
export function buildModifiedPool(): string[] {
	const out: string[] = [];
	for (let t = Date.UTC(2016, 0, 1); t <= Date.UTC(2024, 11, 31); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
	return out;
}

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 17,
		key: 'the-dead-website',
		title: 'The Dead Website',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: true,
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
			privateData: { answer: ctx.attributionAnswer! },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	getAttributionPool() {
		return buildModifiedPool();
	},
};

export default challenge;
