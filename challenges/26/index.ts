/**
 * Q26 — Daniel Reyes, Again
 *
 * The Bureau personnel archive is numbered P-0001 to P-0400 in order of engagement.
 * Its search index only shows the 2015 Reyes file, but every file can be opened by
 * number. Enumerating them turns up six more "REYES, DANIEL" files. Three (1952, 1971,
 * 1994, one per cycle) carry the 2015 man's handwriting, written down by each era's
 * examiner in a different convention (slope from the horizontal, radians, width over
 * height). The other three are ordinary namesakes whose metrics differ once converted.
 * Near-miss names are decoys too. "Daniel Reyes" is not a person. It's a role.
 *
 * Artifacts (served by /{event}/evidence/26/{name}): index.txt and P-NNNN.txt.
 * Personalized: the Reyes, namesake and decoy file positions from ctx.rng.
 * Answer: the four role files; order and separators do not matter.
 *
 * Q29 contribution: none
 * Mutable: no
 */
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q26Private {
	/** Canonical answer: the four Reyes file numbers, ascending. */
	answer: string;
	reyes: number[];
	/** Namesakes: same name, different handwriting. */
	namesakes: number[];
	/** File number → decoy name. */
	decoys: Record<number, string>;
}

export const FILES = 400;
const REYES_YEARS = [1952, 1971, 1994, 2015];
const DECOY_NAMES = ['REYES, DOROTHY', 'REYNOLDS, DANIEL', 'REYES, DAVID', 'RAYES, DANIELLE'];
const FIRST = ['ARTHUR', 'MARGARET', 'HAROLD', 'EDITH', 'LEONARD', 'IRENE', 'WALTER', 'JOAN', 'PETER', 'SUSAN', 'GRAHAM', 'NORA', 'COLIN', 'RUTH', 'MARTIN', 'CLAIRE'];
const LAST = ['ASHBY', 'BRENNAN', 'CROFT', 'DALLOWAY', 'ELLIS', 'FENWICK', 'GARROD', 'HOLLIS', 'IVES', 'JARVIS', 'KEMBLE', 'LOWRY', 'MARSH', 'NOLAN', 'OAKES', 'PRYCE', 'QUINLAN', 'RUDD', 'SAXBY', 'TALBOT'];
const ROLES = ['Archive clerk', 'Field investigator', 'Records officer', 'Evidence technician', 'Case reviewer', 'Photographer', 'Translator (contract)', 'Courier'];

/** One era's notation per role file (1952, 1971, 1994, 2015): all mean 17°, ratio 0.44, rightward. */
const ROLE_HANDS = [
	'slope 73° from the horizontal, loop height:width 0.44, leans right',
	'stroke angle 17°, loop ratio 0.44, rightward slant',
	'stroke 0.297 rad, loop width/height 2.27, rightward slant',
	'stroke angle 17°, loop ratio 0.44, rightward slant',
];
/** Namesake hands in the same notations, each off by one measure once converted. */
const NAMESAKE_HANDS = [
	'slope 71° from the horizontal, loop height:width 0.44, leans right',
	'stroke 0.297 rad, loop width/height 2.04, rightward slant',
	'stroke angle 17°, loop ratio 0.44, upright slant',
];
const NAMESAKE_ROLES = ['Courier', 'Archive clerk', 'Evidence technician'];

const pad = (n: number) => `P-${String(n).padStart(4, '0')}`;
/** Engagement year implied by a file's position in the sequence. */
const yearOf = (n: number) => 1920 + Math.floor(((n - 1) * 96) / FILES);
/** File number whose position matches a year, used to seat the Reyes files plausibly. */
const slotFor = (year: number) => Math.floor(((year - 1920) * FILES) / 96) + 1;

function hash(n: number) {
	let h = Math.imul(n ^ 0x9e3779b9, 2654435761);
	return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0);
}

function record(n: number, name: string, role: string, photo: string, hand: string, status: string, year = yearOf(n)) {
	return [
		'BLACKWOOD INVESTIGATIVE BUREAU — PERSONNEL FILE',
		'',
		`File:         ${pad(n)}`,
		`Name:         ${name}`,
		`Engaged:      ${year}`,
		`Role:         ${role}`,
		`Photograph:   ${photo}`,
		`Handwriting:  ${hand}`,
		`Status:       ${status}`,
		'',
	].join('\n');
}

export function buildFile(p: Q26Private, n: number): string {
	const r = p.reyes.indexOf(n);
	if (r >= 0) {
		const roles = [
			'Provenance researcher (contract) — assisting the Ilves inquiry (child missing, 1952)',
			'Provenance researcher (contract) — private collection sales',
			'Cataloguing assistant (contract) — Vale acquisitions',
			'Archive researcher (contract) — Vale estate',
		];
		return record(n, 'REYES, DANIEL', roles[r],
			'male, approx. 30–40', ROLE_HANDS[r],
			r === 3 ? 'Active' : 'Contract ended — no forwarding address', REYES_YEARS[r]);
	}
	const k = p.namesakes.indexOf(n);
	if (k >= 0) return record(n, 'REYES, DANIEL', NAMESAKE_ROLES[k], 'male, approx. 30–40', NAMESAKE_HANDS[k], 'Retired');
	const h = hash(n);
	const angle = 8 + (h() % 20);
	const hand = `stroke angle ${angle === 17 ? 18 : angle}°, loop ratio 0.${30 + (h() % 40)}, ${h() % 2 ? 'rightward' : 'upright'} slant`;
	const age = 22 + (h() % 30);
	const photo = `${h() % 2 ? 'male' : 'female'}, approx. ${age}–${age + 10}`;
	const name = p.decoys[n] ?? `${LAST[h() % LAST.length]}, ${FIRST[h() % FIRST.length]}`;
	return record(n, name, ROLES[h() % ROLES.length], photo, hand, h() % 3 ? 'Retired' : 'Resigned');
}

export function buildIndex(p: Q26Private): string {
	return [
		'BLACKWOOD BUREAU — PERSONNEL SEARCH',
		"Query: name = 'Daniel Reyes'",
		'',
		`1 result:  ${pad(p.reyes[3])}.txt   REYES, DANIEL   engaged 2015`,
		'',
		`Files are numbered ${pad(1)} to ${pad(FILES)} in order of engagement.`,
		'Only files cleared for the public index appear in search results.',
		'',
	].join('\n');
}

const challenge: ChallengeModule<Public, Q26Private> = {
	metadata: {
		slot: 26,
		key: 'daniel-reyes-again',
		title: 'Daniel Reyes, Again',
		tier: 'hard',
		basePoints: 400,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Every file opens by its number, indexed or not. More than one man in the archive is called Daniel Reyes; the role is in the hand, not the name.',
		},
		{
			order: 2,
			text: "Each era's examiner wrote handwriting differently: slope from the horizontal is 90° minus the stroke angle, radians convert to degrees, width/height is the inverse ratio. Keep only files that match the 2015 file on all three measures.",
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q26Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const reyes: number[] = [];
		for (const y of REYES_YEARS) reyes.push(Math.min(FILES, Math.max(1, slotFor(y) + (await ctx.rng.int(-3, 4)))));
		const decoys: Record<number, string> = {};
		for (const name of DECOY_NAMES) {
			let n: number;
			do n = 1 + (await ctx.rng.int(0, FILES)); while (reyes.includes(n) || decoys[n]);
			decoys[n] = name;
		}
		const namesakes: number[] = [];
		for (let i = 0; i < NAMESAKE_HANDS.length; i++) {
			let n: number;
			do n = 1 + (await ctx.rng.int(0, FILES)); while (reyes.includes(n) || decoys[n] || namesakes.includes(n));
			namesakes.push(n);
		}
		const base = `/${ctx.eventSlug}/evidence/26`;

		const prompt = [
			'BLACKWOOD BUREAU — PERSONNEL ARCHIVE',
			'',
			`Search: name = 'Daniel Reyes'   →   1 result   (${base}/index.txt)`,
			'',
			'One file. Engaged 2015. The Daniel you have been chasing.',
			'',
			'The search index only covers files cleared for public view.',
			'The archive itself is numbered in order of engagement, and',
			'every file opens directly by its number:',
			`  ${base}/P-0001.txt  …  ${base}/P-0400.txt`,
			'',
			'List every file that belongs to the man in the 2015 file,',
			'whatever year it was written.',
			'(Format: P-NNNN, comma-separated)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: reyes.map(pad).join(', '), reyes, namesakes, decoys },
		};
	},

	validate(instance, normalizedAnswer) {
		const got = [...new Set(normalizedAnswer.toUpperCase().match(/P-\d{4}/g) ?? [])].sort();
		return { correct: got.join(', ') === instance.privateData.answer };
	},

	artifact(instance, name) {
		if (name === 'index.txt') return { body: buildIndex(instance.privateData), contentType: 'text/plain; charset=utf-8' };
		const m = /^P-(\d{4})\.txt$/.exec(name);
		const n = m ? Number(m[1]) : 0;
		if (n < 1 || n > FILES) return null;
		return { body: buildFile(instance.privateData, n), contentType: 'text/plain; charset=utf-8' };
	},
};

export default challenge;
