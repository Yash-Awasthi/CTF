/**
 * Q25 — Three Sources
 *
 * An old photograph from the Bureau's suppressed annex shows "D. REYES" decades
 * before the 2015 Daniel could exist. No source prints the date. The newspaper in
 * the picture shows its issue number and weekday, with a thumb over the hundreds
 * digit; its masthead says it has numbered every day except Sunday since 3 January
 * 1870. The negative sleeve (compressed zTXt, invisible to `strings`) gives month and
 * year, which picks the one hidden digit that fits. The print stock bounds the year.
 * The scan's Creation Time (2008) is a trap. This breaks Q24's conviction.
 *
 * Artifact (served by /{event}/evidence/25/annex-photograph-114.png): grayscale PNG
 * drawn pixel by pixel, with tEXt and zTXt metadata readable by exiftool.
 * Personalized: the date (1968–1971, inside Cycle 3), grain and layout from ctx.rng.
 * Answer: YYYY-MM-DD. It exists only as an issue number in the pixels.
 *
 * Q29 contribution: the print's reverse carries the stamp TC-III-W (Cycle 3, Witness).
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import { Gray, png } from '../shared/raster';
import { noise } from '../shared/audio';

interface Public {
	prompt: string;
	token: string;
}
export interface Q25Private {
	answer: string;
	/** Which of the four people holds the newspaper (0-based, never Reyes). */
	holder: number;
}

export const FILE = 'annex-photograph-114.png';
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const FIRST_ISSUE = Date.UTC(1870, 0, 3); // a Monday

/** Issue number of a (non-Sunday) date: issue 1 on 3 January 1870, none on Sundays. */
export function issueOf(answer: string): number {
	const [y, m, d] = answer.split('-').map(Number);
	const n = (Date.UTC(y, m - 1, d) - FIRST_ISSUE) / 86_400_000 + 1;
	return n - Math.floor(n / 7);
}

export async function buildPhotograph(p: Q25Private): Promise<Uint8Array<ArrayBuffer>> {
	const [y, m, d] = p.answer.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	const img = new Gray(480, 320);
	for (let j = 0; j < 320; j++) img.rect(0, j, 480, 1, 150 - j * 0.15);
	img.rect(0, 230, 480, 90, 105);
	const xs = [80, 185, 290, 395];
	xs.forEach((x, i) => {
		const tall = i % 2 ? 6 : 0;
		img.ellipse(x, 270 - tall, 50, 112, 45 + i * 6);
		img.rect(x - 8, 138 - tall, 16, 22, 160 - i * 4);
		img.ellipse(x, 120 - tall, 22, 27, 175 - i * 4);
		img.ellipse(x, 98 - tall, 23, 11, 40);
		img.rect(x - 10, 118 - tall, 5, 2, 60);
		img.rect(x + 5, 118 - tall, 5, 2, 60);
		img.rect(x - 5, 134 - tall, 10, 2, 110);
	});
	// The newspaper, held at chest height.
	const nx = Math.min(305, Math.max(5, xs[p.holder] - 85));
	img.rect(nx, 180, 170, 62, 222);
	img.rect(nx + 6, 186, 158, 1, 90);
	img.text(nx + 7, 190, 'CALDWELL EVENING CHRONICLE', 30);
	img.rect(nx + 6, 199, 158, 1, 90);
	const no = issueOf(p.answer).toLocaleString('en-GB');
	img.text(nx + 7, 203, `NO. ${no}  ${DAYS[date.getUTCDay()]}`, 60);
	img.text(nx + 7, 214, 'EST. MON 3 JAN 1870', 110);
	img.text(nx + 7, 224, 'DAILY EXCEPT SUNDAYS', 110);
	img.rect(nx + 7, 235, 150, 2, 150);
	// The holder's thumb covers the hundreds digit.
	img.ellipse(nx + 7 + 6 * (4 + no.length - 3) + 2, 206, 6, 10, 168);
	// Grain and vignette.
	const rnd = noise();
	for (let j = 0; j < 320; j++) for (let i = 0; i < 480; i++) {
		const k = j * 480 + i;
		const d2 = ((i - 240) ** 2 + (j - 160) ** 2) / 84_100;
		const v = img.px[k] * (1 - 0.45 * d2) + rnd() * 9;
		img.px[k] = v < 0 ? 0 : v > 255 ? 255 : v;
	}
	return png(img, {
		Title: 'Blackwood annex, item 114 — group photograph',
		Description: 'Silver gelatin print on Ferrania bromide paper (stock manufactured 1958-1971). Reverse: "D. REYES - estate contact", stamp TC-III-W.',
		'Creation Time': '2008:06:11 14:02:37',
		Software: 'Blackwood Archive Scan Station 2.1',
	}, {
		Comment: `Negative sleeve, transcribed at scanning: roll 14, frame 9, developed ${MONTHS[m - 1].slice(0, 3)} ${y}.`,
	});
}

const challenge: ChallengeModule<Public, Q25Private> = {
	metadata: {
		slot: 25,
		key: 'three-sources',
		title: 'Three Sources',
		tier: 'hard',
		basePoints: 350,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The paper in the picture never prints a date, only how it counts itself. Not every metadata chunk in a PNG is plain text.',
		},
		{
			order: 2,
			text: 'Count publishing days from the masthead date, skipping Sundays. Try each digit under the thumb; only one lands in the month the negative sleeve gives, on the weekday printed beside it.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q25Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const y = 1968 + (await ctx.rng.int(0, 4));
		const m = 1 + (await ctx.rng.int(0, 12));
		let d = 1 + (await ctx.rng.int(0, 28));
		if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) d += 1;
		const answer = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const holder = await ctx.rng.choice([0, 2, 3]);

		const prompt = [
			'LATE ITEM — RECEIVED 3 MINUTES AFTER CASE 71-C WAS CLOSED',
			'',
			"Unsigned. Routed from the Bureau's own suppressed annex, not Daniel's archive.",
			'Four people. The second from the left is labelled \'D. REYES\'',
			'in handwriting on the reverse. He looks to be in his mid-30s.',
			'',
			'Evidence: annex-photograph-114.png (Bureau scan of the print)',
			'',
			'Nothing in the file states when the photograph was taken.',
			'Three sources narrow it: what is in the picture, what the scan',
			'file records about the negative, and the paper it was printed on.',
			'No one of them is enough.',
			'',
			'If he was in his mid-30s then, he would be past eighty in 2015.',
			'He is not.',
			'',
			'What date was the photograph taken? (Format: YYYY-MM-DD)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer, holder },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	async artifact(instance, name) {
		if (name !== FILE) return null;
		return { body: await buildPhotograph(instance.privateData), contentType: 'image/png' };
	},
};

export default challenge;
