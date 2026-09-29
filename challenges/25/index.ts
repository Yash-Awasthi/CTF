/**
 * Q25 — Three Sources
 *
 * An old photograph from the Bureau's suppressed annex shows "D. REYES" decades
 * before the 2015 Daniel could exist. Three sources date it: the newspaper held in
 * the picture (exact date, readable only by zooming the image), the negative-sleeve
 * note in the PNG text metadata (month and year), and the print stock range. The
 * scan's own Creation Time (2008) is a trap. This breaks Q24's conviction.
 *
 * Artifact (served by /{event}/evidence/25/annex-photograph-114.png): grayscale PNG
 * drawn pixel by pixel, with tEXt metadata readable by exiftool.
 * Personalized: the date (1968–1975, inside Cycle 3), grain and layout from ctx.rng.
 * Answer: YYYY-MM-DD. It is never in page text; the day only exists in the pixels.
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
	seed: string;
	/** Which of the four people holds the newspaper (0-based, never Reyes). */
	holder: number;
}

export const FILE = 'annex-photograph-114.png';
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

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
	img.text(nx + 7, 203, `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`, 60);
	for (let r = 0; r < 4; r++) img.rect(nx + 7, 216 + r * 6, 150 - (r % 2) * 40, 2, 150);
	// Grain and vignette.
	const rnd = noise(p.seed);
	for (let j = 0; j < 320; j++) for (let i = 0; i < 480; i++) {
		const k = j * 480 + i;
		const dist = Math.hypot(i - 240, j - 160) / 290;
		img.px[k] = Math.max(0, Math.min(255, img.px[k] * (1 - 0.45 * dist * dist) + rnd() * 9));
	}
	return png(img, {
		Title: 'Blackwood annex, item 114 — group photograph',
		Description: 'Silver gelatin print on Ferrania bromide paper (stock manufactured 1958-1971). Reverse: "D. REYES - estate contact", stamp TC-III-W.',
		Comment: `Negative sleeve, transcribed at scanning: roll 14, frame 9, developed ${MONTHS[m - 1].slice(0, 3)} ${y}.`,
		'Creation Time': '2008:06:11 14:02:37',
		Software: 'Blackwood Archive Scan Station 2.1',
	});
}

const challenge: ChallengeModule<Public, Q25Private> = {
	metadata: {
		slot: 25,
		key: 'three-sources',
		title: 'Three Sources',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'One source is inside the picture: zoom in on what one of them is holding. The other two are in the file itself — read its text metadata with exiftool or a PNG chunk viewer.',
		},
		{
			order: 2,
			text: 'Ignore the Creation Time — that is when the Bureau scanned the print in 2008. The negative sleeve gives the month and year; the newspaper date line gives the day.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q25Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const y = 1968 + (await ctx.rng.int(0, 8));
		const m = 1 + (await ctx.rng.int(0, 12));
		const d = 1 + (await ctx.rng.int(0, 28));
		const answer = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const holder = await ctx.rng.choice([0, 2, 3]);
		const seed = await ctx.rng.string(12, ALPHABETS.upper);

		const prompt = [
			'LATE ITEM — RECEIVED 3 MINUTES AFTER CASE 71-C WAS CLOSED',
			'',
			"Unsigned. Routed from the Bureau's own suppressed annex, not Daniel's archive.",
			'Four people. The second from the left is labelled \'D. REYES\'',
			'in handwriting on the reverse. He looks to be in his mid-30s.',
			'',
			'Evidence: annex-photograph-114.png (Bureau scan of the print)',
			'',
			'Date the photograph from three independent sources:',
			'  1. what is in the picture,',
			'  2. what the scan file records about the negative,',
			'  3. the paper it was printed on.',
			'The scan carries its own timestamps. They date the scan, not the photograph.',
			'',
			'If he was in his mid-30s then, he would be past eighty in 2015.',
			'He is not.',
			'',
			'What date was the photograph taken? (Format: YYYY-MM-DD)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer, seed, holder },
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
