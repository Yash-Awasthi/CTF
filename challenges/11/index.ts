/**
 * Q11 — VERIFIED
 *
 * The participant accesses a provenance-verification portal for Doll #6.
 * The portal displays a prominent "VERIFIED" badge and an apparently complete
 * ownership chain. However, the verification scope controlling what records
 * the provenance endpoint returns is read from the browser's localStorage.
 *
 * Manipulating the `prov_clearance` key from "standard" to "full" and
 * re-querying the endpoint reveals a suppressed intermediate owner whose
 * record was excluded from the standard verification scope.
 *
 * The suppressed owner's entry names D. Reyes as the archive access contact,
 * creating the lead that causes Q12.
 *
 * Vulnerability isolation:
 *   - The `prov_clearance` localStorage key is intentionally trusted by the
 *     /{event}/provenance/q11 endpoint for which fictional records to return.
 *   - It cannot bypass authentication, progression, or real platform security.
 *   - Only fictional provenance records are exposed through this mechanism.
 *
 * Personalization: recordRef (cosmetic) + ownerName (answer, from pool of 15).
 * Q29 contribution: none — confirmed §17 anomaly table.
 * Mutable: the Q28 Ledger later shows the suppressed owner in the historical
 *   role table (subtler variant — fills a gap rather than contradicting).
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

export interface Q11Public {
	/** Cosmetic archive reference, e.g. "VPRS-011-4821". Varies per participant. */
	readonly recordRef: string;
}

interface Q11Private {
	/** Suppressed intermediate owner name — the answer. */
	readonly answer: string;
}

/**
 * Pool of plausible Cycle-3 (1968–1979) intermediary collector names.
 * Story Bible §1 confirms the collection "passes through at least two private
 * sales" in this period — no canonical owner is named, so the pool is used.
 */
export const OWNER_POOL: readonly string[] = [
	'HARLAN VOSS',
	'CONSTANCE BIRCH',
	'ODELL FINCH',
	'MAREN LOTT',
	'SUTTON GREY',
	'PETRA CROWE',
	'WENDELL PASK',
	'ISOLDE REIN',
	'CORMAC VANE',
	'THEODORA SALT',
	'FRIEDA MURCH',
	'ALISTAIR DUNE',
	'ROSALIND FENN',
	'BARNABY CROSS',
	'LUCINDA FRAME',
];

const challenge: ChallengeModule<Q11Public, Q11Private> = {
	metadata: {
		slot: 11,
		key: 'verified',
		title: 'VERIFIED',
		tier: 'medium',
		basePoints: 200,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The "VERIFIED" badge reflects what the portal chooses to include in its verification scope — not necessarily what the underlying archive contains.',
		},
		{
			order: 2,
			text: "The portal's verification scope is stored in your browser's localStorage. Inspect the application storage in DevTools and consider what happens when that value changes.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q11Public, Q11Private>> {
		const refNum    = await ctx.rng.int(1000, 9999);
		const ownerName = await ctx.rng.choice(OWNER_POOL);

		return {
			publicData:  { recordRef: `VPRS-011-${refNum}` },
			privateData: { answer: ownerName },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
