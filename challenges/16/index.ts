/**
 * Q16 — There Were Six
 *
 * The photograph from Q7 is revisited — and has changed. It now shows six
 * figures where seven existed before, and the EXIF timestamp has been altered.
 * Attribution-enabled: each participant's altered timestamp is unique, making
 * copied answers detectable.
 *
 * Q29 contribution: none (the mutation itself is the observable anomaly —
 *   participants noting "this changed" is the experience, not a secondary clue)
 * Mutable: v2 (altered from Q7 v1) — the definitive change is registered here.
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

/**
 * Attribution pool: 360 distinct altered timestamps (post-2016, all after
 * Mira's 2015 disappearance — proving the photo was modified recently).
 */
function generateTimestampPool(): string[] {
	const pool: string[] = [];
	const years = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
	const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
	const days = ['04', '09', '14', '19', '24'];
	const times = ['02:17', '08:44', '14:22', '21:56', '03:31', '17:08'];

	for (const year of years) {
		for (const month of months) {
			for (const day of days) {
				// Each year-month-day gets one time slot to keep pool bounded
				const time = times[(parseInt(year) + parseInt(month) + parseInt(day)) % times.length];
				pool.push(`${year}:${month}:${day} ${time}:00`);
			}
		}
	}
	return pool; // 600 entries — well above 116-participant roster
}

/** Exported for test access. */
export const TIMESTAMP_POOL = generateTimestampPool();

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 16,
		key: 'there-were-six',
		title: 'There Were Six',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: true,
	},
	hints: [
		{
			order: 1,
			text: "You have seen this photograph before — really look again. Count carefully.",
		},
		{
			order: 2,
			text: 'The figure count changed. The timestamp changed. Both are in the EXIF. Submit the altered DateTimeOriginal value.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const alteredTimestamp = ctx.attributionAnswer!;

		const prompt = [
			'VALE ESTATE — PHOTOGRAPH EVIDENCE (ITEM 8, REVISED)',
			'',
			'The photograph from Q7 has been replaced.',
			'',
			'Whoever did this was careful — but not thorough.',
			'Figure count dropped from seven to six. One person is gone.',
			'GPS location field: cleared.',
			'Caption on the reverse: still reads \'Six figures\' — not updated.',
			'Timestamp: altered to a post-2015 date.',
			'',
			'Download the current version using the link below.',
			'Open the file in a text editor or source viewer.',
			'The XMP metadata block is embedded in the SVG structure.',
			'Find the DateTimeOriginal field.',
			'',
			'What is the altered timestamp? (Format: YYYY:MM:DD HH:MM:SS)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: alteredTimestamp },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	getAttributionPool(_rosterSize: number): string[] {
		return TIMESTAMP_POOL;
	},
};

export default challenge;
