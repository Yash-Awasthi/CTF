/**
 * Q6 — The Directory
 *
 * The participant follows the Ashwick Trades Directory lead from Q5's hidden
 * workshop article. The directory is a historical index of commercial contacts
 * in the Pembridge district, assigned sequential identifiers (D-001 onwards).
 *
 * The visible index shows several entries around a gap — one entry has been
 * suppressed from the public listing. Its ID is inferrable from the sequence.
 * The participant navigates directly to /{event}/directory/{hiddenEntryId}
 * and finds the suppressed contact detail: AUGUSTUS VALE, listed under the
 * Vale House estate in Pembridge's Northern Quarter.
 *
 * Technique: IDOR / sequential entry enumeration.
 * Participant flow:
 *   1. Arrive from Q5's workshop article (Ashwick Trades Directory lead).
 *   2. See the visible directory entries; notice a gap in the sequence.
 *   3. Navigate to /{event}/directory/{hiddenEntryId}.
 *   4. Read the suppressed entry: contact name = AUGUSTUS VALE.
 *   5. Note the .cts document reference (Q29 anomaly — incidental at Q6).
 *   6. Submit "Augustus Vale".
 *
 * Personalization: Yes — the hidden entry ID varies per participant (cosmetic).
 *   The canonical contact name (AUGUSTUS VALE) is shared. Anti-cheat: each
 *   participant's hidden path is at a different D-XXX, making URL-sharing
 *   across participants ineffective.
 *
 * Mutable: No.
 *
 * Q29 contribution: the suppressed entry's document reference has a .cts
 *   extension — an anomalous format from the BPHA digitisation project.
 *   Incidental at Q6, significant at Q29.
 *
 * Connection → Q7: The suppressed entry reveals Augustus Vale at Vale House,
 *   Northern Quarter, Pembridge. The participant's next step is to locate a
 *   historical photograph of the Vale estate and inspect it for provenance data.
 *
 * Answer: AUGUSTUS VALE (case-insensitive, exactMatch).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

export interface DirectoryEntry {
	readonly id: string;
	readonly name: string;
	readonly category: string;
	readonly years: string;
}

/**
 * Structured public data for Q6.
 *
 * `hiddenEntryId` is in publicData because the challenge page shows the
 * directory sequence — the ID gap is visible (the surrounding IDs are shown),
 * and the /{event}/directory/{id} route uses this value to validate access.
 *
 * The contact name "AUGUSTUS VALE" lives only in privateData.
 * It does NOT appear in the directoryEntries array (the suppressed row is
 * absent from the visible listing, not shown with a redacted name).
 */
export interface Q6Public {
	/** Anti-cheat session reference. Varies per participant. */
	sessionToken: string;
	/** The suppressed entry ID, e.g. "D-042". Varies per participant. */
	hiddenEntryId: string;
	/**
	 * Visible directory entries shown in the challenge page — 4 entries
	 * surrounding the gap (2 before, 2 after). The gap at hiddenEntryId
	 * is absent from this array; its position is inferrable from the IDs.
	 */
	directoryEntries: readonly DirectoryEntry[];
}

const challenge: ChallengeModule<Q6Public, { answer: string }> = {
	metadata: {
		slot: 6,
		key: 'the-directory',
		title: 'The Directory',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The entry identifiers in the directory are sequential. Notice which number is absent from the visible listing.',
		},
		{
			order: 2,
			text: 'Try adjacent numbers to the ones visible. The path /{event}/directory/D-XXX may return a suppressed record.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q6Public, { answer: string }>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);

		// Hidden entry offset: range 35–75 → D-035 through D-075.
		// Neighbours (±1, ±2) remain 3-digit and > D-001.
		const hiddenNum = await ctx.rng.int(35, 75);
		const p = (n: number) => `D-${String(n).padStart(3, '0')}`;
		const hiddenEntryId = p(hiddenNum);

		// Four visible entries surrounding the gap (2 before, 2 after).
		// Marrow's Ashwick Figureworks is always 1 step before the gap —
		// this makes the narrative Q5→Q6 link explicit in the listing.
		const directoryEntries: DirectoryEntry[] = [
			{
				id: p(hiddenNum - 2),
				name: 'J. Carrow, Cabinet Maker',
				category: 'Furnishings & craft',
				years: '1873–1882',
			},
			{
				id: p(hiddenNum - 1),
				name: 'Marrow, J. — Ashwick Figureworks',
				category: 'Artisan & commission',
				years: '1871–1889',
			},
			// hiddenNum entry is absent from the visible listing
			{
				id: p(hiddenNum + 1),
				name: "Pemberton's Yard, Coal & Timber",
				category: 'Building trades',
				years: '1874–1891',
			},
			{
				id: p(hiddenNum + 2),
				name: 'Crane Bros., Auctioneers',
				category: 'Commerce',
				years: '1870–1893',
			},
		];

		return {
			publicData: { sessionToken, hiddenEntryId, directoryEntries },
			privateData: { answer: 'AUGUSTUS VALE' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
