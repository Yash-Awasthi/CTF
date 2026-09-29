/**
 * Q23 — Mira's Last Recording
 *
 * A damaged tape recovered from Mira's effects. Played back it is hiss, rumble and
 * muffled fragments. Mira did not trust saying it aloud: she wrote it into the
 * recording's spectrum, where a spectrogram shows "DANIEL" and a deposit box number.
 *
 * Artifact (served by /{event}/evidence/23/mira-recording-2015-05.wav): 8 kHz mono
 * WAV, 45 s. The text sits between 3.0 and 3.8 kHz starting near 0:34. The page has
 * no spectrogram tool; players bring their own (Audacity, Sonic Visualiser).
 * Personalized: box number, noise and burst timing from ctx.rng.
 * Answer: the box number. The name alone is guessable from the story, so the
 * question asks for what only the audio holds.
 *
 * Q29 contribution: none
 * Mutable: no
 */
import { oneOf } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import { RATE, addSine, noise, paintText, wav } from '../shared/audio';

interface Public {
	prompt: string;
	token: string;
}
export interface Q23Private {
	answer: string;
}

export const FILE = 'mira-recording-2015-05.wav';
const SECONDS = 45;
export const TEXT_START = 34;

export function buildRecording(p: Q23Private): Uint8Array<ArrayBuffer> {
	const buf = new Float32Array(SECONDS * RATE);
	const rnd = noise();
	// Tape hiss plus 50 Hz hum, then muffled speech-like bursts (low-passed noise).
	let lp = 0;
	let env = 0;
	let target = 0;
	for (let i = 0; i < buf.length; i++) {
		if (i % 1200 === 0) target = rnd() > 0.1 ? Math.abs(rnd()) : 0;
		env += (target - env) * 0.002;
		lp += (rnd() - lp) * 0.08;
		buf[i] = 0.06 * rnd() + 0.9 * env * lp;
	}
	addSine(buf, 0, buf.length, 50, 0.08, 1);
	paintText(buf, `DANIEL  BOX ${p.answer}`, TEXT_START, 0.08, 3000, 3800, 0.05);
	return wav(buf);
}

const challenge: ChallengeModule<Public, Q23Private> = {
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
			text: 'Nothing useful is audible. Mira hid it where ears do not look — view the frequencies over time instead of listening.',
		},
		{
			order: 2,
			text: 'Open the WAV in Audacity (track menu → Spectrogram) or Sonic Visualiser and look at the upper band, above 3 kHz, from about 0:34.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q23Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const answer = await ctx.rng.string(4, ALPHABETS.digits);

		const prompt = [
			'MIRA CASTELLAN — RECOVERED AUDIO (DAMAGED)',
			'',
			"A tape recovered from Mira's personal effects, digitised as",
			`${FILE}. Degradation and overwrite artifacts throughout.`,
			'',
			'--- FORENSIC AUDIO REPORT ---',
			'Duration:  0:45',
			'Speech:    fragments only — no intelligible words recovered',
			'Fragment:  "...afraid of what ... is. Not who. What."',
			'Note:      unexplained narrow-band energy in the upper range,',
			'           inaudible under the hiss. Not tape noise.',
			'--- END REPORT ---',
			'',
			'Mira knew the recording might be heard by the wrong person.',
			'She did not say the name aloud. She put it somewhere else,',
			'along with where she left the rest of her evidence.',
			'',
			'What box number did Mira leave in the recording?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer },
		};
	},

	validate(instance, normalizedAnswer) {
		const a = instance.privateData.answer;
		return oneOf(normalizedAnswer.replace(/\s+/g, ' '), [a, `box ${a}`, `daniel box ${a}`]);
	},

	artifact(instance, name) {
		if (name !== FILE) return null;
		return { body: buildRecording(instance.privateData), contentType: 'audio/wav' };
	},
};

export default challenge;
