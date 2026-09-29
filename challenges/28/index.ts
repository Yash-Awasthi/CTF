/**
 * Q28 — The Ledger
 *
 * Following "follow the names", the investigator reaches a records database that
 * tracks the same five roles through every cycle since 1871. Most cells are blank.
 * The Ledger only prints the current row once the earlier rows are rebuilt from
 * names found across the case — two of them this player's own answers (their Q10
 * register file and their Q11 suppressed owner), one their own codename.
 *
 * The rebuilt table reveals Cycle 6, whose open role carries a reference in the
 * same TC-<cycle>-<role> format as the stamp on Q25's photograph. That reference
 * is the answer (attribution-enabled: unique per player).
 *
 * Validation of the table happens in POST /{event}/ledger; this module only holds
 * the expected cells. Cells compare case- and punctuation-insensitively.
 * Q29 contribution: the Ledger's unsigned marginal doctrine, with its nouns burned out.
 * Mutable: fills the gap left in Q11's provenance chain.
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import { getCodename } from '../shared/codenames';

export const ROLES = ['COLLECTOR', 'SUBJECT', 'INVESTIGATOR', 'WITNESS', 'SUCCESSOR'] as const;

/** A cell is either printed text or a blank the player must fill (by id). */
export type LedgerCell = { text: string } | { blank: string };
export interface LedgerRow {
	cycle: string;
	years: string;
	cells: LedgerCell[];
}
export interface Q28Public {
	prompt: string;
	token: string;
	rows: LedgerRow[];
}
export interface Q28Private {
	answer: string;
	/** blank id → accepted value (compared after upper-casing and collapsing spaces) */
	expected: Record<string, string>;
}

export const normalizeCell = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]+/g, ' ').trim();

export function buildLedger(q10File: string, q11Owner: string, codename: string) {
	const expected: Record<string, string> = {
		c1c: 'JOSIAH MARROW', c1s: 'ALBA ROURKE', c1i: 'THADDEUS GRIEVE',
		c2c: 'EDGAR HOLT', c2s: 'PETER ILVES',
		c3c: q11Owner, c3s: q10File, c3w: 'DANIEL REYES',
		c4c: 'SILAS VALE', c4n: 'MIRA CASTELLAN',
		c5s: 'MIRA CASTELLAN', c5i: 'MIRA CASTELLAN', c5w: 'H. GULL', c5n: codename,
	};
	const t = (text: string): LedgerCell => ({ text });
	const b = (blank: string): LedgerCell => ({ blank });
	const rows: LedgerRow[] = [
		{ cycle: '1', years: '1871–1889', cells: [b('c1c'), b('c1s'), b('c1i'), t('[unnamed — shop apprentice]'), t('[unnamed — orphan boy]')] },
		{ cycle: '—', years: '1930s', cells: [t('[untraced]'), t('[regional, unlinked]'), t('[none recorded]'), t('[unclear]'), t('[chain broken?]')] },
		{ cycle: '2', years: '1948–1954', cells: [b('c2c'), b('c2s'), t('[REDACTED — page torn]'), t('[unclear]'), t('[source for next cycle]')] },
		{ cycle: '3', years: '1968–1979', cells: [b('c3c'), b('c3s'), t('[untraced — vanished 1979]'), b('c3w'), t('[untraced]')] },
		{ cycle: '4', years: '1990s–2014', cells: [b('c4c'), t('[none confirmed]'), t('[none confirmed]'), t('[the Collector himself]'), b('c4n')] },
		{ cycle: '5', years: '2015', cells: [t('VALE ESTATE (posthumous)'), b('c5s'), b('c5i'), b('c5w'), b('c5n')] },
	];
	return { rows, expected };
}

/** Per-row verdicts for a submitted table; rows are right only when every blank in them is. */
export function checkLedger(rows: LedgerRow[], expected: Record<string, string>, given: Record<string, unknown>): boolean[] {
	return rows.map((row) =>
		row.cells.every((c) => !('blank' in c) || (typeof given[c.blank] === 'string' && normalizeCell(given[c.blank] as string) === normalizeCell(expected[c.blank]))),
	);
}

const challenge: ChallengeModule<Q28Public, Q28Private> = {
	metadata: {
		slot: 28,
		key: 'the-ledger',
		title: 'The Ledger',
		tier: 'hard',
		basePoints: 350,
		attributionEnabled: true,
	},
	hints: [
		{
			order: 1,
			text: 'Every blank is a name you have already met: the 1889 registry and the heritage page, the 1948 owner, your own Q10 and Q11 answers, the caretaker who reported Mira missing, a stamp on a photograph.',
		},
		{
			order: 2,
			text: 'Two rows are about you. Mira was both the Subject and the Investigator of her cycle. The Successor of a cycle is whoever inherits its file next; in 2015 that was the person the Bureau reassigned 71-C to, under the codename it gave you.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Q28Public, Q28Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const q10 = ((await ctx.related(10)).privateData as { answer: string }).answer;
		const q11 = ((await ctx.related(11)).privateData as { answer: string }).answer;
		const { rows, expected } = buildLedger(q10, q11, getCodename(ctx.rollNumber));

		const prompt = [
			'THE LEDGER — HISTORICAL RECORDS DATABASE',
			'',
			'Mira said: follow the names. They led here.',
			'',
			'The database tracks five roles through every cycle since 1871:',
			'  COLLECTOR     holds the objects, never by choice',
			'  SUBJECT       disappears; an object resembled them first',
			'  INVESTIGATOR  notices, by professional accident',
			'  WITNESS       sees one piece, survives, keeps the fragments',
			'  SUCCESSOR     inherits the file when the cycle closes',
			'',
			'Most cells are blank. The Ledger will not print the current row',
			'until the earlier rows are complete. Rebuild them from what you found.',
			'',
			'Marginal note, unsigned, repeated in every cycle\'s file:',
			"  '█████ CHANGE. █████ REMAIN. █████ CHANGE. █████ REMAIN.",
			"   THE INVESTIGATION MUST CONTINUE.'",
			'',
			'Submit the reference the Ledger assigns to the role still open',
			'in the current cycle.',
		].join('\n');

		return {
			publicData: { prompt, token, rows },
			privateData: { answer: ctx.attributionAnswer!, expected },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer.replace(/\s+/g, ''), instance.privateData.answer);
	},

	getAttributionPool() {
		// 1,000 references covers the 200-player cap; attribution shuffles the whole pool per request.
		return Array.from({ length: 1000 }, (_, i) => `TC-VI-S-${String(1000 + i * 7).padStart(4, '0')}`);
	},
};

export default challenge;
