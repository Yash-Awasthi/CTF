/**
 * Q2 — Eleven Years Cold
 *
 * The participant receives Mira Castellan's official disappearance case file.
 * The file is complete in appearance — professional, institutional, archived.
 * But the evidence inventory is subtly flagged as potentially incomplete, and
 * one evidence item (Mira's private notebook) has been suppressed from the
 * rendered display.
 *
 * Technique: HTML/page-source inspection (beginner-level).
 * A system-generated reconciliation comment in the delivered HTML references
 * the suppressed evidence item by its accession number. The participant
 * inspects the page source, finds the comment, and submits the accession
 * number to unlock Q3 (the notebook itself).
 *
 * The hidden comment exists for an in-world reason: Blackwood's archive
 * software auto-generates a reconciliation note whenever a record is
 * suppressed from view. It does not strip these notes from delivered HTML.
 * This is a realistic representation of institutional software behavior.
 *
 * Narrative purpose: humanize Mira, establish known facts of her
 * disappearance, introduce the first discrepancy between visible records and
 * underlying records, and give the participant a concrete reason to access
 * her private notebook in Q3.
 *
 * Q29 contribution: none
 * Mutable: no
 * Personalized: no (answer is the same for all participants; token varies for
 *   anti-cheat parity but does not affect solving)
 *
 * Answer: EVD-71C-017  (case-insensitive; the private notebook accession ref)
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

const MONTH_ABBR = [
	'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
	'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/**
 * Structured public data for Q2.
 *
 * Each field maps to a section of the case-file layout rendered by
 * [slot].astro when view.key === 'eleven-years-cold'. The page assembles
 * these into an institutional case record — no monolithic prompt string.
 *
 * SECURITY: none of these fields contain the answer (EVD-71C-017).
 * The answer appears only in the delivered HTML as an auto-generated comment.
 */
export interface Q2Public {
	/** Anti-cheat session reference (varies per participant, does not affect solve). */
	sessionToken: string;
	/** Formatted date the case was reassigned to the current participant. */
	reassignedOn: string;

	// ── Case header ─────────────────────────────────────────────────────────
	caseId: string;           // "71-C"
	filedDate: string;        // "22 OCT 2015"
	closedDate: string;       // "11 MAR 2016"
	caseStatus: string;       // "COLD — REASSIGNED FOR REVIEW"

	// ── Subject ──────────────────────────────────────────────────────────────
	subjectName: string;      // "MIRA CASTELLAN"
	subjectYOB: string;       // "1981"
	subjectOccupation: string;
	subjectStatus: string;    // "MISSING — WHEREABOUTS UNKNOWN"

	// ── Incident / timeline ──────────────────────────────────────────────────
	contractStart: string;    // "04 JUN 2015"
	lastContact: string;      // "17 OCT 2015"
	lastContactNote: string;  // brief description of the last communication
	reportedBy: string;       // "H. Gull (estate caretaker)"
	reportedDate: string;     // "19 OCT 2015"
	filedWith: string;        // "Blackwood Investigative Bureau, 22 OCT 2015"

	// ── Closing ──────────────────────────────────────────────────────────────
	closingNote: string;
}

/** The suppressed evidence accession number — answer for this challenge. */
export const SUPPRESSED_EVIDENCE_REF = 'EVD-71C-017';

const challenge: ChallengeModule<Q2Public, { answer: string }> = {
	metadata: {
		slot: 2,
		key: 'eleven-years-cold',
		title: 'Eleven Years Cold',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The evidence inventory is flagged as incomplete. Check what is in the source of this page that is not visible in the rendered record.',
		},
		{
			order: 2,
			text: 'Archive software sometimes leaves reconciliation notes in generated HTML. Use View Source or browser DevTools to read the full page markup.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q2Public, { answer: string }>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);

		const now = new Date();
		const reassignedOn =
			`${String(now.getUTCDate()).padStart(2, '0')} ` +
			`${MONTH_ABBR[now.getUTCMonth()]} ` +
			`${now.getUTCFullYear()}`;

		return {
			publicData: {
				sessionToken,
				reassignedOn,
				caseId: '71-C',
				filedDate: '22 OCT 2015',
				closedDate: '11 MAR 2016',
				caseStatus: 'COLD — REASSIGNED FOR REVIEW',
				subjectName: 'MIRA CASTELLAN',
				subjectYOB: '1981',
				subjectOccupation: 'Freelance investigator and estate appraiser',
				subjectStatus: 'MISSING — WHEREABOUTS UNKNOWN',
				contractStart: '04 JUN 2015',
				lastContact: '17 OCT 2015',
				lastContactNote:
					'Email to estate executor — noted initial inventory "nearing completion," ' +
					'expected preliminary report by end of month.',
				reportedBy: 'H. Gull (estate caretaker)',
				reportedDate: '19 OCT 2015',
				filedWith: 'Blackwood Investigative Bureau — 22 OCT 2015',
				closingNote:
					'No evidence of criminal activity or third-party involvement. ' +
					"Subject's absence attributed to voluntary withdrawal from engagement. " +
					'File archived. No further action required.',
			},
			privateData: { answer: SUPPRESSED_EVIDENCE_REF },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
