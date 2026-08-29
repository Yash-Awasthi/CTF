/**
 * Q23 — Mira's Last Recording
 *
 * A damaged audio file recovered from Mira's effects. The relevant segment is
 * buried in noise. Basic forensics (isolation, slow playback, spectral filter)
 * recovers a single name — the person Mira said she feared. Fixed: DANIEL.
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
		slot: 23,
		key: 'miras-last-recording',
		title: "Mira's Last Recording",
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The important segment is buried in noise. Try isolating frequencies above 300Hz or slowing the track to 0.5x speed.',
		},
		{
			order: 2,
			text: "The recoverable segment is short — a single name. It's at the 34-second mark after noise reduction is applied.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			"MIRA CASTELLAN — RECOVERED AUDIO (PARTIALLY RESTORED)",
			'',
			"A voice recording recovered from Mira's personal effects.",
			"Physical tape degradation and overwrite artifacts. Most content is gone.",
			'',
			"--- FORENSIC AUDIO REPORT ---",
			"File:     mira-recording-2015-05.wav",
			"Duration: 1:12  (recoverable: 9 seconds at 0:34–0:43)",
			"Process:  spectral subtraction + 0.5x playback recovery",
			'',
			"TRANSCRIPT — recoverable segment:",
			'',
			"  [noise] [noise] — I am afraid of — [noise] — it is [NOISE] —",
			"  [noise] DANIEL [2.1 seconds noise] [noise]",
			'',
			"POST-PROCESSING (300Hz high-pass filter, 0.5x speed):",
			'',
			"  I am afraid of what DANIEL is. Not who. What.",
			'',
			"The name is the only segment recoverable at normal playback speed.",
			"--- END REPORT ---",
			'',
			"Who does Mira name in the recovered segment?",
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'DANIEL' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
