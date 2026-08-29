/**
 * Q8 — Lot 47
 *
 * The participant arrives from Q7's auction-house EXIF lead and searches the
 * Sovereign Auction House legacy catalogue for the Vale estate sale. A normal
 * search hides Lot 47. A beginner SQL injection surfaces it — revealing an
 * origin phrase that predates Silas Vale's birth.
 *
 * Attribution-enabled: each participant's Lot 47 origin phrase is unique (drawn
 * from a pool of 266 = 19 years × 14 descriptions, all Marrow-era). This makes
 * copied answers detectable without changing what the participant discovers or
 * how they discover it.
 *
 * Personalization: catalogueRef (SAH-VALE-XXXX) varies per participant.
 * Answer: participant's attributed originPhrase (shared answer space is the pool).
 *
 * Mutable: no.
 * Q29 contribution: none (Story Bible §20 table; §17 anomaly list).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

// ── Public interface (browser-visible) ───────────────────────────────────────

export interface Q8Public {
	readonly sessionToken: string;
	/**
	 * Cosmetic catalogue reference (SAH-VALE-XXXX). Shown in the portal header
	 * as the Vale estate sale record number. Anti-cheat: each participant sees
	 * a distinct reference number.
	 */
	readonly catalogueRef: string;
}

// ── Private interface (server-only) ──────────────────────────────────────────

interface Q8Private {
	readonly answer: string; // participant's attributed origin phrase
}

// ── Attribution pool ──────────────────────────────────────────────────────────

/**
 * 266 distinct Lot 47 origin phrases (19 Marrow-era years × 14 description
 * variants). All plausibly describe an 1871–1889 Marrow estate acquisition
 * that predates Silas Vale's birth (1940s). Attribution makes copied answers
 * detectable; the discovery mechanic (SQLi) remains identical for everyone.
 *
 * Exported so the search API can reference the same pool description for
 * consistent display of the suppressed record.
 */
export function buildLot47Pool(): readonly string[] {
	const years: number[] = [];
	for (let y = 1871; y <= 1889; y++) years.push(y);

	const descriptions = [
		'MARROW ESTATE COMMISSION, PRIVATE SALE',
		'MARROW WORKSHOP \u2014 ORIGINAL PRODUCTION',
		'J. MARROW, COMMISSIONED PIECE',
		'MARROW ESTATE \u2014 PRIVATE COMMISSION',
		'MARROW DOLLWORKS, PRIVATE ORDER',
		'J. MARROW WORKSHOP \u2014 SALE RECORD',
		'MARROW ESTATE INVENTORY \u2014 LISTED',
		'MARROW WORKSHOP CATALOGUE ENTRY',
		'J. MARROW PRIVATE COMMISSION, REGISTERED',
		'MARROW ESTATE \u2014 ACQUISITION ON RECORD',
		'MARROW COMMISSION, DOCUMENTED',
		'J. MARROW DOLLWORKS ORIGINAL',
		'MARROW ESTATE PRIVATE LISTING',
		'MARROW WORKSHOP \u2014 COMMISSION RECORD',
	] as const;

	const pool: string[] = [];
	for (const year of years) {
		for (const desc of descriptions) {
			pool.push(`ACQUIRED ${year}, ${desc}`);
		}
	}
	return pool; // 266 entries
}

const LOT_47_POOL = buildLot47Pool();

// ── Module ───────────────────────────────────────────────────────────────────

const challenge: ChallengeModule<Q8Public, Q8Private> = {
	metadata: {
		slot: 8,
		key: 'lot-47',
		title: 'Lot 47',
		tier: 'medium',
		basePoints: 150,
		attributionEnabled: true,
	},
	hints: [
		{
			order: 1,
			text: 'Search boxes that talk directly to a database sometimes trust your input more than they should. Try including SQL syntax in the lot number field.',
		},
		{
			order: 2,
			text: "A single quote in the search field reveals the underlying query structure. Injecting ' OR lot_id=47 -- bypasses the listing filter and surfaces the suppressed record.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q8Public, Q8Private>> {
		const sessionToken  = await ctx.rng.string(8, ALPHABETS.upper);
		const refNum        = await ctx.rng.int(1000, 9999);
		const catalogueRef  = `SAH-VALE-${refNum}`;
		const originPhrase  = ctx.attributionAnswer!;

		return {
			publicData : { sessionToken, catalogueRef },
			privateData: { answer: originPhrase },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	getAttributionPool(_rosterSize: number): string[] {
		return [...LOT_47_POOL];
	},
};

export default challenge;
