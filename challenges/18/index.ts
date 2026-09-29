/**
 * Q18 — For You
 *
 * A voicemail arrives on the investigation line. Nobody speaks: the caller keyed
 * the message in Morse over a hissing line, and the message names the owner this
 * player uncovered at Q11. Someone knows what you found. The phrase is the answer.
 *
 * Artifact (served by /{event}/evidence/18/voicemail.wav): 8 kHz mono WAV with
 * line noise, the phrase keyed at 1 kHz, and a quiet 440 Hz carrier keyed
 * "NAMES REMAIN" on repeat. The page offers a spectrogram view of the same file.
 * Personalized: template, keying speed and noise from ctx.rng; the name comes from
 * this player's own Q11 answer. The phrase never appears in page text or data.
 *
 * Q29 contribution: the carrier spells NAMES REMAIN, one doctrine line.
 * Mutable: no
 */
import { oneOf } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import { RATE, keyTone, morse, noise, wav } from '../shared/audio';

interface Public {
	prompt: string;
	token: string;
}
export interface Q18Private {
	answer: string;
	/** Morse unit length in milliseconds. */
	unitMs: number;
	seed: string;
}

/** Render the voicemail. Returns the WAV bytes. */
export function buildVoicemail(p: Q18Private): Uint8Array<ArrayBuffer> {
	const unit = p.unitMs / 1000;
	const msg = morse(p.answer);
	const lead = 1.5;
	const seconds = Math.ceil(lead * 2 + msg.units * unit);
	const buf = new Float32Array(seconds * RATE);
	const rnd = noise(p.seed);
	for (let i = 0; i < buf.length; i++) buf[i] = 0.08 * rnd();
	const doctrine = morse(CARRIER);
	for (let t = 0.3; t + doctrine.units * 0.1 < seconds; t += doctrine.units * 0.1) keyTone(buf, doctrine.on, 0.1, t, 440, 0.05);
	keyTone(buf, msg.on, unit, lead, 1000, 0.35);
	return wav(buf);
}

export const CARRIER = 'NAMES REMAIN';

/** Message templates; {NAME} and {SURNAME} come from this player's Q11 answer. Exported for tests. */
export const TEMPLATES: readonly string[] = [
	'YOU FOUND {NAME}',
	'{NAME} WAS NEVER MEANT TO BE FOUND',
	'LEAVE {SURNAME} IN THE ARCHIVE',
	'{SURNAME} HELD IT BEFORE VALE',
	'STOP READING ABOUT {SURNAME}',
];

const challenge: ChallengeModule<Public, Q18Private> = {
	metadata: {
		slot: 18,
		key: 'for-you',
		title: 'For You',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Nobody speaks. The pattern of long and short beeps is the message — an old code for sending letters over a wire.',
		},
		{
			order: 2,
			text: 'Decode the 1 kHz beeps as Morse code (the spectrogram shows them as dots and dashes). Ignore the quiet 440 Hz tone. Submit the decoded words.'
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q18Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const owner = ((await ctx.related(11)).privateData as { answer: string }).answer;
		const phrase = (await ctx.rng.choice(TEMPLATES))
			.replace('{NAME}', owner)
			.replace('{SURNAME}', owner.split(' ').pop()!);
		const unitMs = 70 + (await ctx.rng.int(0, 21));
		const seed = await ctx.rng.string(12, ALPHABETS.upper);

		const prompt = [
			'INVESTIGATION LINE — UNPLAYED VOICEMAIL',
			'',
			'Case 71-C  ·  Blackwood Investigative Bureau',
			'Caller:    WITHHELD',
			'Voice:     NONE DETECTED — tones only',
			'Status:    UNPLAYED — flagged for manual review',
			'',
			'A voicemail arrived on the case contact line after the archive was accessed.',
			'The caller identity was suppressed at source.',
			'A quieter tone runs underneath the whole message. Keyed, not steady.',
			'',
			'The caller did not speak. Whoever it was knew what you found.',
			'Play the recording, or open it as a spectrogram.',
			'',
			'What message did the caller send?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: phrase, unitMs, seed },
		};
	},

	validate(instance, normalizedAnswer) {
		const a = instance.privateData.answer;
		return oneOf(normalizedAnswer.replace(/\s+/g, ' '), [a, a.replace(/\s+/g, '')]);
	},

	artifact(instance, name) {
		if (name !== 'voicemail.wav') return null;
		return { body: buildVoicemail(instance.privateData), contentType: 'audio/wav' };
	},
};

export default challenge;
