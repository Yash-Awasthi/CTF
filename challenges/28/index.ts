/**
 * Q28 — The Ledger
 *
 * Following Mira's instruction ("follow the names"), the participant locates a
 * historical records database spanning 1871–present. Reconstructing the role
 * table from names gathered across Q1–27 reveals five repeating roles across
 * six cycles. The participant's own case (Cycle 6) is already a row — with one
 * role currently unassigned. Personalized: the participant's roll number is
 * embedded in their own Ledger row. Fixed answer: SUCCESSOR.
 *
 * Q29 contribution: the Ledger contains incomplete doctrine-field fragments —
 *   "PEOPLE CHANGE. [REDACTED]. RECORDS CHANGE. [REDACTED]. THE INVESTIGATION
 *   MUST CONTINUE." — planted in the database as unsigned marginal notes.
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
interface Private {
	answer: string;
}

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 28,
		key: 'the-ledger',
		title: 'The Ledger',
		tier: 'hard',
		basePoints: 350,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Build the table before looking for the solution. Each cycle has the same five roles — fill in what you know from Q1 through Q27.',
		},
		{
			order: 2,
			text: 'Your own case is already a row in the table. Look at the current cycle entry. One role field reads PENDING. That is what you submit.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'THE LEDGER — HISTORICAL RECONSTRUCTION',
			'',
			'Follow the names.',
			'',
			'Cross-referencing names and roles recovered from Q1–Q27 against',
			'fragmentary historical archives produces a pattern.',
			'',
			'--- THE LEDGER ---',
			'',
			'Five roles repeat across every cycle:',
			'  COLLECTOR | SUBJECT | INVESTIGATOR | WITNESS | SUCCESSOR',
			'',
			'Cycle 1 (1871–1889):',
			'  Collector:    JOSIAH MARROW',
			'  Subject:      ALBA ROURKE',
			'  Investigator: THADDEUS GRIEVE',
			'  Witness:      [unnamed — shop apprentice]',
			'  Successor:    [unnamed — orphan boy]',
			'  Note:         Grieve\'s final casebook pages — missing',
			'',
			'Silent Decade (1930s):',
			'  [Records incomplete — possible break in cycle]',
			'  [This decade remains permanently unexplained]',
			'',
			'Cycle 2 (1948–1954):',
			'  Collector:    [MARROW GRANDNEPHEW — unnamed]',
			'  Subject:      PETER ILVES',
			'  Investigator: [REDACTED]',
			'  Witness:      [unclear]',
			'  Successor:    next cycle\'s investigator source',
			'  Daniel ref.:  first confirmed marginal reference',
			'  Note:         investigator notes end mid-sentence',
			'',
			'Cycle 3 (1968–1979):',
			'  Collector:    [unnamed private owners]',
			'  Subject:      [unnamed woman — matched Q10]',
			'  Investigator: [UNNAMED — vanished 1979]',
			'  Witness:      [unclear]',
			'  Daniel ref.:  records show \'engaged 1968\'  (Q26)',
			'',
			'Cycle 4 (1983–1990):',
			'  [Records withheld — Blackwood suppressed annex]',
			'',
			'Cycle 5 (Vale era, 1990s–2015):',
			'  Collector:    SILAS VALE',
			'  Subject:      MIRA CASTELLAN',
			'  Investigator: YOU (Case 71-C)',
			'  Witness:      H. GULL (estate caretaker)',
			'  Daniel ref.:  \'engaged 2015\' (Q26, Record 4)',
			'',
			'Each cycle ends the same way.',
			'The investigator\'s notes stop. The subject disappears.',
			'The only constant across 150 years is a name.',
			'',
			'Marginal note, unsigned, repeated in every cycle\'s file:',
			"  'PEOPLE CHANGE. [REDACTED]. RECORDS CHANGE. [REDACTED].",
			"   THE INVESTIGATION MUST CONTINUE.'",
			'',
			'What role does Daniel Reyes occupy in every recorded cycle?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: 'SUCCESSOR' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
