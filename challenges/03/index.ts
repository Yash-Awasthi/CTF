/**
 * Q3 — The Last Notebook
 *
 * The participant receives Mira Castellan's private notebook as a scanned
 * evidence item (EVD-71C-017, the reference they recovered in Q2).
 *
 * The notebook scan is rendered as an inline SVG in the page: most of the
 * text is visible at normal contrast, but the address Mira wrote near the
 * bottom is in extremely faded ink — barely distinguishable from the paper.
 *
 * Technique: forensic image inspection.
 * Two valid solving paths (both use browser DevTools):
 *   1. Apply a CSS contrast filter to the SVG element:
 *        filter: contrast(10)
 *      — makes the faded ink legible.
 *   2. Inspect the SVG DOM elements directly in the Elements panel:
 *        the address text nodes are readable as-is.
 *
 * This technique is meaningfully different from Q2 (HTML comment / View Source).
 * Q2 required finding hidden markup in the page source; Q3 requires visual
 * forensic manipulation or DOM inspection of a rendered artifact.
 *
 * Personalization: Yes — one of 16 address variants via participant RNG.
 * Each participant's address appears embedded in their SVG rendering;
 * answers from other participants' pages are useless here.
 *
 * Mutable: Yes.
 *   v1 (Q3): first page — address only, early investigative notes.
 *   v2 (Q20): late page — describes evidence-change phenomenon.
 *   v3 (Q27): final page — cipher line, Mira's conclusion.
 *
 * Q29 contribution: "THE" is underlined everywhere it appears in the visible
 * notebook text. Participants who pay attention may notice the pattern;
 * it becomes significant at Q29. Do NOT expose this connection in Q3 copy.
 *
 * Answer: full address string, e.g. "14 Ashwick Road, Pembridge"
 *   Accepted with or without the comma (normalized, case-insensitive).
 */
import { oneOf } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

/** Pool of address variants. Multi-digit street numbers leave enough digits
 *  visible for reconstruction even when partially obscured. */
const ADDRESSES: readonly string[] = [
	'14 Ashwick Road, Pembridge',
	'22 Corvin Lane, Thornfield',
	'37 Harlow Street, Caldwell',
	'31 Morrow Passage, Greystone',
	'19 Inkwell Court, Saltmere',
	'43 Fallow End, Wickhurst',
	'18 Dredge Row, Aldmoor',
	'55 Bastion Close, Fernwick',
	'27 Lacuna Walk, Dunhollow',
	'11 Remnant Yard, Stave Cross',
	'60 Vestige Lane, Harrowfield',
	'63 Cairn Street, Moorside',
	'88 Threshold Road, Clearwater',
	'15 Reliquary Alley, Greyfen',
	'33 Sextant Row, Portwick',
	'72 Wanderer Close, Ashfen',
];

/**
 * Structured public data for Q3.
 *
 * `streetLine` and `district` are the address components rendered in
 * very low-contrast faded-ink SVG text inside the notebook scan.
 * They are in publicData because they ARE in the page DOM (in the SVG
 * element's text nodes) — the challenge is recovering them visually,
 * not hiding them from all inspection.
 *
 * The `answer` field lives only in privateData.
 */
export interface Q3Public {
	/** Anti-cheat / session reference. Varies per participant. */
	sessionToken: string;
	/** Evidence accession number — bridges Q2's discovery to Q3. */
	evidenceRef: string;
	/** Notebook date for the evidence metadata panel. */
	notebookDate: string;
	/** Street number + road name (e.g. "14 Ashwick Road"). Faded in SVG. */
	streetLine: string;
	/** District / town (e.g. "Pembridge"). Faded in SVG. */
	district: string;
}

const challenge: ChallengeModule<Q3Public, { answer: string }> = {
	metadata: {
		slot: 3,
		key: 'the-last-notebook',
		title: 'The Last Notebook',
		tier: 'easy',
		basePoints: 100,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The notebook scan contains text that is present but not clearly visible — look at the lower section of the page near where Mira left instructions.',
		},
		{
			order: 2,
			text: 'Open browser DevTools and adjust the CSS filter on the scan element. Try: filter: contrast(10). Alternatively, inspect the SVG elements directly in the DOM.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q3Public, { answer: string }>> {
		const sessionToken = await ctx.rng.string(8, ALPHABETS.upper);
		const address = await ctx.rng.choice(ADDRESSES);

		const commaIdx = address.lastIndexOf(',');
		const streetLine = address.slice(0, commaIdx).trim();
		const district = address.slice(commaIdx + 1).trim();

		return {
			publicData: {
				sessionToken,
				evidenceRef: 'EVD-71C-017',
				notebookDate: '15 OCT 2015',
				streetLine,
				district,
			},
			privateData: { answer: address },
		};
	},

	validate(instance, normalizedAnswer) {
		const base = instance.privateData.answer;
		// Accept "14 Ashwick Road, Pembridge" and "14 Ashwick Road Pembridge"
		return oneOf(normalizedAnswer, [base, base.replace(',', '')]);
	},
};

export default challenge;
