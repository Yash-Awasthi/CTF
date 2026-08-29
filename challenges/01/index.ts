/**
 * Q1 — The Assignment
 *
 * The participant's first contact with CASE 71-C. They receive a cold-case
 * reassignment memo from Blackwood Investigative Bureau addressed to them by
 * an operational designation. Confirming that designation activates casebook
 * access and unlocks Q2.
 *
 * Design intent: the designation (codename) surfaces naturally in the memo's
 * TO: field — the address the document is written to — not as an explicit
 * puzzle prompt. The confirmation form asks them to "confirm their designation
 * to accept the assignment," which reads as a system requirement rather than a
 * CTF instruction. Participants who read carefully notice it immediately;
 * those who don't can request a hint.
 *
 * The designation is reproduced deterministically at Q30 from the same formula.
 * No separate storage is required. Do NOT modify getCodename() without updating
 * Q30 as well.
 *
 * Q29 contribution: none
 * Mutable: no
 * attributionEnabled: false — codenames are deterministic by roll number,
 *   not assigned from a shuffled pool, so the attribution system is not used.
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import { getCodename } from '../shared/codenames';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

const MONTH_ABBR = [
	'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
	'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/**
 * Structured public data for Q1.
 *
 * Each field maps to a specific section of the institutional memo layout
 * rendered by [slot].astro when view.key === 'the-assignment'. Using
 * named fields instead of a pre-formatted prompt string allows the page
 * to style each piece of information appropriately and place the codename
 * (designation) naturally in the TO: block without labeling it as an answer.
 *
 * SECURITY NOTE: no field is named "answer". The `designation` field IS the
 * correct submission, but its name matches the in-universe concept so the
 * invariant `!('answer' in publicData)` continues to pass.
 */
export interface Q1Public {
	/** Always "71-C". Shown in memo metadata. */
	caseId: string;
	/** Issue date, formatted "DD MON YYYY" (UTC at generation time). */
	issuedOn: string;
	/** Random 8-uppercase-char session token shown as a credential reference. */
	sessionToken: string;
	/**
	 * The participant's investigator codename (the answer). Appears in the
	 * memo's TO: field as their operational designation — not as a labeled
	 * answer field. Also the correct submission for Q30 (The Subject).
	 */
	designation: string;
	/** Participant roll number, shown as a reference in the TO: block. */
	rollNumber: number;
	/** Subject full name for the subject record block. */
	subjectName: string;
	/** Last known location and approximate date. */
	subjectLastSeen: string;
	/** Current administrative classification of the subject. */
	subjectStatus: string;
}

interface Private {
	answer: string;
}

const challenge: ChallengeModule<Q1Public, Private> = {
	metadata: {
		slot: 1,
		key: 'the-assignment',
		title: 'The Assignment',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Your designation appears in the memo header — in the field the document is addressed to.',
		},
		{
			order: 2,
			text: 'The TO: line of the assignment memo contains your operational designation. Enter it to confirm and proceed.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q1Public, Private>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);
		const codename = getCodename(ctx.rollNumber);

		const now = new Date();
		const issuedOn =
			`${String(now.getUTCDate()).padStart(2, '0')} ` +
			`${MONTH_ABBR[now.getUTCMonth()]} ` +
			`${now.getUTCFullYear()}`;

		return {
			publicData: {
				caseId: '71-C',
				issuedOn,
				sessionToken,
				designation: codename,
				rollNumber: ctx.rollNumber,
				subjectName: 'MIRA CASTELLAN',
				subjectLastSeen: 'VALE ESTATE — OCT 2015',
				subjectStatus: 'MISSING — CASE 71-C',
			},
			privateData: { answer: codename },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
