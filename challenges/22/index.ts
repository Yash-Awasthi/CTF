/**
 * Q22 — The Alibi
 *
 * Cross-referencing the audit log timestamp (Q21) against transit and building
 * access records reveals a window where Daniel's stated location is impossible.
 * He claimed to be at one location during the critical window; the records place
 * him elsewhere. The actual location breaks his alibi.
 * Fixed answer: VALE ESTATE NORTH WING
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
		slot: 22,
		key: 'the-alibi',
		title: 'The Alibi',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Line up the timestamps side by side — transit departure, building entry, and the archive write all have logged times.',
		},
		{
			order: 2,
			text: "One window doesn't add up. He can't be in transit and inside the building simultaneously. The building entry log wins — it's physical, not digital.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'ALIBI RECONSTRUCTION — DANIEL REYES',
			'',
			'Archive write timestamp (Q21): 2015-10-03 at 02:41',
			'',
			'Daniel\'s statement to Blackwood Bureau:',
			'  \'I was traveling overnight, departing Caldwell at 23:00 on October 2.',
			'  I arrived at my flat in Thornfield at approximately 03:15 on October 3.\'',
			'',
			'--- TRANSIT LOG (Route CN-7, overnight coach) ---',
			'Date:    2015-10-02 to 2015-10-03',
			'Depart:  Caldwell Central, 23:05',
			'Arrive:  Thornfield Station, 03:12',
			'Manifest: D. REYES — seat 14B (booked)',
			'Boarding: NOT RECORDED — passenger did not board',
			'--- END LOG ---',
			'',
			'--- BUILDING ACCESS LOG (Vale Estate Management) ---',
			'Date: 2015-10-03',
			'',
			'02:19  REYES, D — card swipe — MAIN ENTRANCE',
			'02:23  REYES, D — card swipe — VALE ESTATE NORTH WING',
			'02:44  REYES, D — card swipe — VALE ESTATE NORTH WING (exit)',
			'02:47  REYES, D — card swipe — MAIN ENTRANCE (exit)',
			'--- END LOG ---',
			'',
			'He did not board the coach. At 02:41 he was inside the building.',
			'',
			'Which location does the building access log place him during the write window?',
			'(02:23–02:44 — submit the specific location name from the log.)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'VALE ESTATE NORTH WING' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
