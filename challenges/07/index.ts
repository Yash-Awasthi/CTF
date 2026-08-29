/**
 * Q7 — The Seventh Figure
 *
 * A historical estate photograph from the Vale collection. The printed caption
 * claims six figures; the photograph contains seven. EXIF inspection reveals
 * that the image's true location (GPSAreaInformation) is SOVEREIGN AUCTION
 * HOUSE — not the stated Pembridge Municipal Archive.
 *
 * Personalized: photoRef (VE-XXXX) and exifDate vary per participant.
 * Answer is canonical (shared): SOVEREIGN AUCTION HOUSE.
 *
 * Mutable: returns at Q16 with one fewer figure and an altered EXIF timestamp.
 * The Q7 public interface is designed so that Q16's module can re-use the same
 * [slot].astro rendering branch by emitting figureCount: 6 + a new exifDate.
 *
 * Q29 contribution: none.
 * Story Bible §20 definitively marks Q7 as having no Q29 anomaly. The Q29
 * anomaly table (§17) lists exactly ten sources; Q7 is not among them.
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

// ── Public interface (browser-visible) ───────────────────────────────────────

export interface Q7Exif {
	/** Deterministic date within Vale's collecting period (2001–2013). */
	readonly dateTimeOriginal: string;
	/** "Group photograph — seven figures present" — contradicts caption. */
	readonly imageDescription: string;
	/** The canonical answer. Participant discovers this by inspecting metadata. */
	readonly gpsAreaInformation: string;
	readonly make: string;
	readonly software: string;
	readonly copyright: string;
}

export interface Q7Public {
	readonly sessionToken: string;
	/**
	 * Participant-specific photo reference (VE-XXXX). Cosmetic anti-cheat:
	 * each participant's evidence viewer shows a distinct accession reference.
	 */
	readonly photoRef: string;
	/**
	 * Full EXIF record. gpsAreaInformation contains the answer; the participant
	 * must open the metadata panel to find it. No 'answer' field is present.
	 */
	readonly exif: Q7Exif;
	/**
	 * Figure count in the photograph (always 7 at Q7; becomes 6 at Q16).
	 * Shared here so Q16 can emit the same public shape without a separate
	 * branch.
	 */
	readonly figureCount: 7;
}

// ── Private interface (server-only) ──────────────────────────────────────────

interface Q7Private {
	readonly answer: string;
}

// ── Canonical truth ───────────────────────────────────────────────────────────

/**
 * The answer for all participants. Shared because the narrative demands it:
 * every participant's EXIF trail must lead to the same auction archive (Q8).
 * Anti-cheat is handled by the cosmetic photoRef variation.
 */
const AUCTION_HOUSE = 'SOVEREIGN AUCTION HOUSE';

// ── Module ───────────────────────────────────────────────────────────────────

const challenge: ChallengeModule<Q7Public, Q7Private> = {
	metadata: {
		slot: 7,
		key: 'the-seventh-figure',
		title: 'The Seventh Figure',
		tier: 'medium',
		basePoints: 150,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The caption and the image do not agree — count the figures, then examine the embedded metadata.',
		},
		{
			order: 2,
			text: "Image files carry embedded technical records beyond what is displayed. Look at the EXIF fields — particularly the GPS area information.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q7Public, Q7Private>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);

		// Cosmetic anti-cheat: each participant's evidence viewer shows a
		// distinct photo accession reference. The answer is unaffected.
		const refNum = await ctx.rng.int(1000, 9999);
		const photoRef = `VE-${refNum}`;

		// Deterministic EXIF timestamp within Vale's collecting period.
		const year  = 2001 + (await ctx.rng.int(0, 12));
		const month = String(await ctx.rng.int(1, 13)).padStart(2, '0');
		const day   = String(await ctx.rng.int(1, 29)).padStart(2, '0');
		const hour  = String(await ctx.rng.int(9, 17)).padStart(2, '0');
		const min   = String(await ctx.rng.int(0, 60)).padStart(2, '0');
		const sec   = String(await ctx.rng.int(0, 60)).padStart(2, '0');
		const exifDate = `${year}:${month}:${day} ${hour}:${min}:${sec}`;

		const exif: Q7Exif = {
			dateTimeOriginal : exifDate,
			imageDescription : 'Group photograph \u2014 seven figures present',
			gpsAreaInformation: AUCTION_HOUSE,
			make             : 'Rollei',
			software         : 'Vale Collection Digital Archive v1.2',
			copyright        : 'Vale Collection \u2014 private archive',
		};

		return {
			publicData : { sessionToken, photoRef, exif, figureCount: 7 },
			privateData: { answer: AUCTION_HOUSE },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
