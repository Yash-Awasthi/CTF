/**
 * Q9 — The Catalogue
 *
 * The participant accesses the full Vale estate archive after uncovering
 * Lot 47's anomaly in Q8. The archive is presented as a downloaded ZIP
 * file browser. A checksum / file-size mismatch in the manifest points
 * to the doll-and-figures inventory CSV, which contains a suppressed
 * Lot 47 record not reflected in the manifest's stated byte count. The
 * hidden record's catalogue reference is the answer, establishing the
 * Doll #6 lead that Q10 pursues through visual comparison.
 *
 * Answer: VALE-M-1882-047 — canonical, shared for all participants.
 *   Format: VALE (estate) · M (Marrow origin) · 1882 (commission year,
 *   Marrow era, well before Silas Vale's birth in the 1940s) · 047 (lot).
 *
 * Personalization: downloadRef (BIB-VALE-XXXX) varies per participant.
 * Attribution: disabled — shared canonical answer, minor anti-cheat via
 *   download reference only. Making the catalogue ID vary would break the
 *   causal chain to Q10, which references a single specific doll record.
 * Q29 contribution: none (Story Bible §17 anomaly table — Q9 not listed).
 * Mutable: no. The Vale archive website referenced in Q17 (Dead Website)
 *   is a separate entity; this challenge's archive is a point-in-time download.
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

// ── Public interface (browser-visible) ───────────────────────────────────────

/** One row from the estate inventory CSV — matches the actual CSV column headers. */
export interface Q9InventoryRow {
	readonly lotId: number;
	readonly catalogueRef: string;
	readonly item: string;
	readonly dateAcquired: string;
	readonly origin: string;
	readonly notes: string;
}

export interface Q9Public {
	/**
	 * Blackwood archive download reference (BIB-VALE-XXXX).
	 * Cosmetic, personalized — shown in the archive header.
	 * Varies per participant for minor anti-cheat without altering historical truth.
	 */
	readonly downloadRef: string;
}

// ── Private interface (server-only) ──────────────────────────────────────────

interface Q9Private {
	readonly answer: string;
}

// ── Canonical answer and hidden entry ────────────────────────────────────────

/**
 * The catalogue reference for the suppressed Lot 47 record.
 * Shared canonical answer — same for all participants.
 * Year 1882 is within the Marrow workshop era (1871–1889) and predates
 * Silas Vale's birth (1940s), making the impossible date immediately apparent.
 */
export const CATALOGUE_ID = 'VALE-M-1882-047';

/**
 * The suppressed Lot 47 inventory entry — identical for all participants.
 * In the archive, this row exists in the CSV file but was not present when
 * the manifest was generated, producing the 449-byte size discrepancy.
 *
 * The other lots use the prefix VALE-F (figures, Vale-era); Lot 47 uses
 * VALE-M (Marrow commission) — a detail that reinforces the anomaly.
 *
 * Exported so tests can assert field-level content without hardcoding strings.
 */
export const LOT_47_ENTRY: Q9InventoryRow = {
	lotId:        47,
	catalogueRef: CATALOGUE_ID,
	item:         'Untitled Figure (Commission)',
	dateAcquired: '1882-03-15',
	origin:       'MARROW WORKSHOP \u2014 COMMISSIONED PIECE',
	notes:        '[SUPPRESSED \u2014 See internal solicitor reference. Do not include in public auction listing.]',
} as const;

// ── Archive text files (served by /{event}/evidence/9/{basename}) ─────────────

const CSV_HEAD = 'lot_id,catalogue_ref,item,date_acquired,origin,notes';
const csv = (v: string) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const lines = (...rows: string[]) => rows.join('\n') + '\n';

/** Text files in the archive by basename; the rest are binary and have no preview. */
export const ARCHIVE_FILES: Readonly<Record<string, string>> = {
	'MANIFEST.txt': lines('VALE ESTATE ARCHIVE — MANIFEST', 'Generated: 2015-04-07 16:02', 'Files: 16', 'Checksums: size-only (legacy export tool)', '', 'Note: manifest regenerated after inventory review. Do not edit inventory files after this point.'),
	'inventory-furniture.csv': lines(CSV_HEAD, '44,VALE-A-1912-044,Oak Writing Table,1912-06-02,VALE ESTATE PURCHASE,', '51,VALE-A-1934-051,Walnut Bureau,1934-09-17,PRIVATE PURCHASE,'),
	'inventory-silverware.csv': lines(CSV_HEAD, '45,VALE-S-1928-045,Silver Candelabra (pair),1928-02-11,PRIVATE COLLECTION,'),
	'inventory-textiles.csv': lines(CSV_HEAD, '46,VALE-T-1956-046,Oriental Rug,1956-10-30,ESTATE CLEARANCE,'),
	'inventory-ceramics.csv': lines(CSV_HEAD, '48,VALE-C-1988-048,Ceramic Vases (set of three),1988-05-19,PRIVATE PURCHASE,'),
	'inventory-dolls-figures.csv': lines(
		CSV_HEAD,
		'12,VALE-F-1994-012,Bisque Doll (seated),1994-03-02,PRIVATE PURCHASE,',
		'19,VALE-F-1996-019,Carved Figure (standing),1996-07-21,ESTATE CLEARANCE,',
		'33,VALE-F-2001-033,Porcelain Doll (pair),2001-11-08,AUCTION LOT,',
		'40,VALE-F-2004-040,Articulated Figure,2004-01-15,PRIVATE PURCHASE,',
		[String(LOT_47_ENTRY.lotId), LOT_47_ENTRY.catalogueRef, LOT_47_ENTRY.item, LOT_47_ENTRY.dateAcquired, LOT_47_ENTRY.origin, LOT_47_ENTRY.notes].map(csv).join(','),
	),
	'appraisal-notes.txt': lines('Appraisal notes — M. Castellan (working copy)', '', 'Figures series: prefix VALE-F throughout, all acquired 1990s onward.', 'Manifest size for the dolls/figures inventory does not match the file on disk. Raised with the executor. No reply.'),
};

// ── Module ───────────────────────────────────────────────────────────────────

const challenge: ChallengeModule<Q9Public, Q9Private> = {
	metadata: {
		slot:               9,
		key:                'the-catalogue',
		title:              'The Catalogue',
		tier:               'medium',
		basePoints:         150,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text:  'Not every file in the archive matches what the manifest records. One inventory file is larger than stated — the difference suggests something was appended after the manifest was generated.',
		},
		{
			order: 2,
			text:  'The doll-and-figures inventory CSV is 449 bytes larger than the manifest claims. The extra content is a suppressed record for Lot 47. Its catalogue reference is what you need.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q9Public, Q9Private>> {
		const refNum     = await ctx.rng.int(1000, 9999);
		const downloadRef = `BIB-VALE-${refNum}`;

		return {
			publicData:  { downloadRef },
			privateData: { answer: CATALOGUE_ID },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	artifact(_instance, name) {
		const body = ARCHIVE_FILES[name];
		return body ? { body, contentType: 'text/plain; charset=utf-8' } : null;
	},
};

export default challenge;
