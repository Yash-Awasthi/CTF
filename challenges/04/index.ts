/**
 * Q4 — The Estate Record
 *
 * The participant searches the Pembridge Municipal Land Registry using the
 * address recovered from Mira's notebook (EVD-71C-017) in Q3.
 *
 * The registry returns one matching property record: a digitised 1889
 * transfer deed for a workshop lot in the Ashwick Industrial Quarter.
 * The deed's filename contains a personalized accession reference
 * (e.g. "estate-record-REG-4271-pembridge-1889.pdf"). That same accession
 * number appears in a registry index printed at the foot of the deed, where
 * it maps to the registered owner of record: JOSIAH MARROW.
 *
 * Technique: filename reading + registry table lookup (beginner-fair).
 * Two valid reading paths:
 *   1. Extract the accession number from the filename shown in the deed
 *      reference section, locate it in the registry index → JOSIAH MARROW.
 *   2. Scan the registry index first, cross-reference against the
 *      accession number in the filename → same result.
 *
 * Personalization: Yes — the accession number suffix varies per participant
 *   (cosmetic). Surrounding registry entries adjust to keep the layout
 *   realistic. The answer (JOSIAH MARROW) is fixed for all participants.
 *
 * Mutable: No.
 * Q29 contribution: None.
 *
 * Connection forward (Q5): Josiah Marrow's name, once identified, leads the
 * participant to investigate his workshop history — the property archive is
 * incomplete, and a forgotten subpage is discoverable via robots.txt (Q5).
 *
 * Answer: JOSIAH MARROW
 *   Accepted: "josiah marrow", "JOSIAH MARROW", "Josiah Marrow"
 *   Rejected: "marrow", "josiah", "REG-NNNN"
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

/** A single row in the registry index printed on the deed. */
export interface RegistryEntry {
	readonly ref: string;
	readonly name: string;
}

/**
 * Structured public data for Q4.
 *
 * The deed filename and registry index are rendered directly in the document
 * panel — they are the legible record, not hidden elements. The challenge is
 * reading the filename carefully and cross-referencing the accession number
 * against the registry table.
 *
 * SECURITY: no field named 'answer'. "JOSIAH MARROW" appears in
 * `registryIndex[3].name` but this is intentional and expected — it is the
 * visible record the participant must read. The engine's security invariant
 * only prohibits a literal `answer` field in publicData.
 */
export interface Q4Public {
	/** Anti-cheat session token. Varies per participant; does not affect solve. */
	sessionToken: string;
	/** Accession reference embedded in the deed filename (e.g. "REG-4271"). */
	accessionRef: string;
	/** Full deed filename as shown in the document reference section. */
	deedFilename: string;
	/** Registry index rows printed at the foot of the deed — exactly 5 entries. */
	registryIndex: readonly RegistryEntry[];
}

const challenge: ChallengeModule<Q4Public, { answer: string }> = {
	metadata: {
		slot: 4,
		key: 'the-estate-record',
		title: 'The Estate Record',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The document filename shown in the deed reference is not decorative — it contains an accession number. Find that number elsewhere in the record.',
		},
		{
			order: 2,
			text: 'The registry index at the foot of the deed maps accession numbers to registered names. Match the filename\'s accession number to its entry.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q4Public, { answer: string }>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);

		// Personalized accession suffix — cosmetic variation, does not affect answer.
		// Range 1004..9994 ensures ± 3 neighbours remain 4-digit numbers.
		const suffix = await ctx.rng.int(1004, 9994);
		const accessionRef = `REG-${suffix}`;
		const deedFilename = `estate-record-${accessionRef}-pembridge-1889.pdf`;

		// Registry index: 5 rows centred on the Marrow accession number.
		// Neighbours are plausible period names drawn from the story world.
		const registryIndex: RegistryEntry[] = [
			{ ref: `REG-${suffix - 3}`, name: 'THADDEUS GRIEVE' },
			{ ref: `REG-${suffix - 2}`, name: 'ALBA ROURKE (MINOR — GUARDIAN: F. ROURKE)' },
			{ ref: `REG-${suffix - 1}`, name: 'ELEANOR MARROW (SPOUSE, DECEASED 1881)' },
			{ ref: accessionRef,          name: 'JOSIAH MARROW' },
			{ ref: `REG-${suffix + 1}`,  name: 'PEMBRIDGE MUNICIPAL COUNCIL' },
		];

		return {
			publicData: { sessionToken, accessionRef, deedFilename, registryIndex },
			privateData: { answer: 'JOSIAH MARROW' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
