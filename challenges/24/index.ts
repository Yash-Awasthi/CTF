/**
 * Q24 — Case Closed
 *
 * All evidence threads converge: motive (protecting the 2001 connection),
 * means (elevated access, Q21), opportunity (Q22 alibi broken), and Mira's
 * named fear (Q23). The participant synthesizes and closes the case — wrongly,
 * as Q25–27 will reveal. Peak false resolution.
 *
 * The board quotes this player's own Q15, Q22 and Q23 answers, but one of them is
 * silently miscopied (records change). The Bureau will not file a board that
 * misquotes its evidence, so the filing needs the name and that exhibit's true value.
 * Answer: DANIEL REYES / <true value>, personal to each player.
 *
 * Q29 contribution: none
 * Mutable: no
 */
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { DeterministicRng } from '../../src/lib/crypto/rng';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import { ROOMS } from '../22/index';

interface Public {
	prompt: string;
	token: string;
}
export interface Q24Private {
	answer: string;
	/** Which exhibit the board misquotes, and its true value. */
	altered: 'met' | 'room' | 'box';
	truth: string;
}

const DAY = 86_400_000;

/** A plausible wrong copy of one exhibit: another day in 2001, another room, one box digit off. */
export async function miscopy(kind: Q24Private['altered'], value: string, rng: DeterministicRng): Promise<string> {
	if (kind === 'room') return rng.choice(ROOMS.filter((r) => r !== value));
	if (kind === 'box') {
		const i = await rng.int(0, value.length);
		const d = (Number(value[i]) + 1 + (await rng.int(0, 9))) % 10;
		return value.slice(0, i) + d + value.slice(i + 1);
	}
	const base = Date.parse(`${value}T00:00:00Z`);
	const step = (1 + (await rng.int(0, 20))) * DAY;
	const later = new Date(base + step).toISOString().slice(0, 10);
	return later.startsWith('2001') ? later : new Date(base - step).toISOString().slice(0, 10);
}

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const challenge: ChallengeModule<Public, Q24Private> = {
	metadata: {
		slot: 24,
		key: 'case-closed',
		title: 'Case Closed',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The board was typed from your notes, not from the evidence. Reopen Q15, Q22 and Q23 and check every quoted value against the source itself.',
		},
		{
			order: 2,
			text: "Exactly one of the meeting date, the room and the box number differs from its evidence. File the full name and that exhibit's true value.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q24Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const found = async (slot: number) => ((await ctx.related(slot)).privateData as { answer: string }).answer;
		const truths = { met: await found(15), room: await found(22), box: await found(23) };
		const altered = await ctx.rng.choice(['met', 'room', 'box'] as const);
		const shown: Record<Q24Private['altered'], string> = { ...truths };
		shown[altered] = await miscopy(altered, truths[altered], ctx.rng);
		const { met, room, box } = shown;

		const prompt = [
			'BLACKWOOD BUREAU — CASE BOARD',
			'',
			'CASE 71-C — EVIDENCE SYNTHESIS',
			'',
			'MOTIVE:',
			`  Reyes met Vale on ${met} (Q15 draft), not in late 2013 as he claimed.`,
			'  Hiding the true provenance (the 1948 owner, the pre-Vale ledger date)',
			'  protects whatever the collection really is.',
			'',
			'MEANS:',
			'  Elevated, unauthorised archive access confirmed by the audit log (Q21).',
			'  He could reach and alter records Mira could not.',
			'  MEMO-published.html was overwritten after her disappearance (Q19).',
			'',
			'OPPORTUNITY:',
			`  His replacement card puts him in the ${room} across the 02:41 write`,
			'  on 2015-10-03 (Q22). He never boarded the coach.',
			'',
			'DIRECT EVIDENCE:',
			`  Mira wrote his name into her own tape, beside box ${box} (Q23).`,
			'  "Afraid of what he is. Not who. What."',
			'',
			'Four independent threads. One name.',
			'',
			'FILING CHECK: the Bureau will not close a case whose board misquotes',
			'its own evidence. This board was typed from your notes.',
			'',
			'File the case: the person responsible, and the true value of the',
			'exhibit the board gets wrong.  (Format: FULL NAME / VALUE)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: `DANIEL REYES / ${truths[altered]}`, altered, truth: truths[altered] },
		};
	},

	validate(instance, normalizedAnswer) {
		const got = clean(normalizedAnswer);
		return { correct: got.startsWith('DANIEL REYES ') && got.slice(13) === clean(instance.privateData.truth) };
	},
};

export default challenge;
