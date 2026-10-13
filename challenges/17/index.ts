/**
 * Q17 — The Dead Website
 *
 * The Vale collection archive website is marked "defunct." But checking the
 * HTTP response headers reveals a Last-Modified date well after Mira's 2015
 * disappearance — someone is still maintaining it.
 *
 * Attribution-enabled: each participant's Last-Modified date is a unique day in
 * 2018–2019, so a shared answer identifies its owner.
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

/** The headers' forged Last-Modified, matching the page's claim. */
export const FORGED_MODIFIED = 'Tue, 12 Nov 2013 09:14:02 GMT';

/** nginx-style ETag: the file's real mtime and size in hex. Nobody thought to forge it. */
export function etagFor(answer: string, size: number): string {
	return `"${(Date.parse(`${answer}T03:22:11Z`) / 1000).toString(16)}-${size.toString(16)}"`;
}

/** Every day of 2018 and 2019, all after Mira's disappearance. Kept small: attribution shuffles the whole pool per request. */
export function buildModifiedPool(): string[] {
	const out: string[] = [];
	for (let t = Date.UTC(2018, 0, 1); t <= Date.UTC(2019, 11, 31); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
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
			text: 'Whoever keeps the site alive also set its Last-Modified header to agree with the banner. Servers fingerprint files in more than one header.',
		},
		{
			order: 2,
			text: "An nginx ETag is two hex numbers joined by a dash: the file's modification time in Unix seconds, then its size in bytes.",
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
			'The page says nothing changed. So do its Last-Modified headers.',
			'Someone took care to make both agree.',
			'',
			'When did the file really last change? (Format: YYYY-MM-DD)',
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
