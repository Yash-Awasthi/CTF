/**
 * Q18 — For You
 *
 * A voicemail arrives on the investigation line. The speaker references something
 * specific to this participant — a detail only they would have found. Buried in
 * the transcript is a background tone that encodes a Q29 fragment. The key
 * spoken phrase is the answer. Personalized via RNG.
 *
 * Q29 contribution: background tone in voicemail audio encodes a fragment of
 *   THE CONTINUITY doctrine ("NAMES REMAIN" — audible at 2x speed or via
 *   waveform inspection, per the challenge narrative).
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
	/** Base64-encoded spoken phrase — used by TTS player in the browser. */
	phraseB64: string;
}
interface Private {
	answer: string;
}

/**
 * Spoken phrases that reference the participant's investigation.
 * These reference generic investigation actions (Q11 owner, archive access, etc.)
 * without needing to cross-reference specific slot outputs.
 */
/** Exported for test access. */
export const SPOKEN_PHRASES: readonly string[] = [
	'YOU FOUND THE TRANSFER RECORD',
	'YOU HAVE THE LEDGER ENTRY',
	'THE ACQUISITION DATE YOU FOUND IS CORRECT',
	'YOU ACCESSED THE ARCHIVE',
	'THE OWNER CHAIN IS COMPLETE',
	'THE PROVENANCE IS BROKEN',
	'YOU KNOW WHO HELD THE LOT',
	'THE RECORD CONFIRMS IT',
	'YOU FOUND THE SUPPRESSED NAME',
	'THE CHAIN LEADS FURTHER BACK',
];

const challenge: ChallengeModule<Public, Private> = {
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
			text: 'Listen for something that could not be generic — the caller references a specific thing only your investigation would have surfaced.',
		},
		{
			order: 2,
			text: 'The spoken phrase addresses you directly and references your findings. Submit the exact spoken message (in capitals).',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const phrase = await ctx.rng.choice(SPOKEN_PHRASES);

		const phraseB64 = btoa(phrase);

		const prompt = [
			'INVESTIGATION LINE — UNPLAYED VOICEMAIL',
			'',
			'Case 71-C  ·  Blackwood Investigative Bureau',
			'Caller:    WITHHELD',
			'Duration:  8.7 seconds',
			'Status:    UNPLAYED — flagged for manual review',
			'',
			'A voicemail arrived on the case contact line after the archive was accessed.',
			'The caller identity was suppressed at source.',
			'Background carrier tone at 440Hz — amplitude modulation archived.',
			'',
			'Play the recording. The message is brief.',
			'',
			'Submit the exact spoken phrase (in capitals).',
		].join('\n');

		return {
			publicData: { prompt, token, phraseB64 },
			privateData: { answer: phrase },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
