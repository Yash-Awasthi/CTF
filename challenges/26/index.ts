/**
 * Q26 — Daniel Reyes, Again
 *
 * The Bureau personnel archive is numbered P-0001 to P-0400 in order of engagement.
 * Its search index only shows the 2015 Reyes file, but every file can be opened by
 * number. Enumerating them turns up three more "REYES, DANIEL" files from 1952, 1971
 * and 1994 (one per cycle): same age on every photograph, same handwriting metrics. Decoys share
 * part of the name. "Daniel Reyes" is not a person. It's a role.
 *
 * Artifacts (served by /{event}/evidence/26/{name}): index.txt and P-NNNN.txt.
 * Personalized: the four Reyes file numbers and the decoy positions from ctx.rng.
 * Answer: all four file numbers; order and separators do not matter.
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
	/** File number → decoy name. */
	decoys: Record<number, string>;
}

export const FILES = 400;
const REYES_YEARS = [1952, 1971, 1994, 2015];
const DECOY_NAMES = ['REYES, DOROTHY', 'REYNOLDS, DANIEL', 'REYES, DAVID', 'RAYES, DANIELLE'];
const FIRST = ['ARTHUR', 'MARGARET', 'HAROLD', 'EDITH', 'LEONARD', 'IRENE', 'WALTER', 'JOAN', 'PETER', 'SUSAN', 'GRAHAM', 'NORA', 'COLIN', 'RUTH', 'MARTIN', 'CLAIRE'];
const LAST = ['ASHBY', 'BRENNAN', 'CROFT', 'DALLOWAY', 'ELLIS', 'FENWICK', 'GARROD', 'HOLLIS', 'IVES', 'JARVIS', 'KEMBLE', 'LOWRY', 'MARSH', 'NOLAN', 'OAKES', 'PRYCE', 'QUINLAN', 'RUDD', 'SAXBY', 'TALBOT'];
const ROLES = ['Archive clerk', 'Field investigator', 'Records officer', 'Evidence technician', 'Case reviewer', 'Photographer', 'Translator (contract)', 'Courier'];

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
			'male, approx. 30–40', 'stroke angle 17°, loop ratio 0.44, rightward slant',
			r === 3 ? 'Active' : 'Contract ended — no forwarding address', REYES_YEARS[r]);
	}
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
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The search only covers indexed files, but every file opens by its number. Four hundred numbers is a job for a loop, not a mouse.',
		},
		{
			order: 2,
			text: 'Fetch P-0001.txt to P-0400.txt with your session cookie (curl or a browser-console loop) and keep the files whose name is exactly REYES, DANIEL. Watch for near-miss names.',
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
			'List every personnel file for Daniel Reyes.',
			'(Format: P-NNNN, comma-separated)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: reyes.map(pad).join(', '), reyes, decoys },
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
