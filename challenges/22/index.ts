/**
 * Q22 — The Alibi
 *
 * Daniel says he was on the overnight coach when MEMO-published.html was
 * overwritten at 02:41 (Q21). The estate's door controller exports swipes by card
 * number only, and the card register holds a trap: his first card was reported
 * lost, so the card that moves that night is the replacement. The room he badged
 * into before 02:41 and out of after it breaks the alibi.
 *
 * Artifacts (served by /{event}/evidence/22/{name}): access-log.csv, card-register.csv.
 * Personalized: card numbers, staff, patrol times and the room, all from ctx.rng.
 * Answer: the room name, which appears only as one door among many in the log.
 *
 * Q29 contribution: none
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q22Private {
	answer: string;
	/** card → [holder, note] */
	register: [string, string, string][];
	/** [timestamp, card, door, result] sorted by time */
	log: [string, string, string, string][];
}

export const ROOMS = ['NORTH WING', 'EAST GALLERY', 'CATALOGUE ROOM', 'ARCHIVE STACK B', 'CONSERVATION LAB', 'LOWER VAULT'];
const STAFF = ['HOLLIS, G.', 'MARSH, E.', 'PRYCE, A.', 'KEMBLE, R.', 'OAKES, J.', 'TALBOT, S.', 'GULL, H.', 'SAXBY, M.', 'REYNOLDS, D.', 'CROFT, L.'];
const CSV = 'text/csv; charset=utf-8';

const at = (mins: number) => {
	// minutes after 2015-10-02 22:00
	const t = new Date(Date.UTC(2015, 9, 2, 22, 0) + mins * 60_000);
	return t.toISOString().replace('T', ' ').slice(0, 19);
};

const challenge: ChallengeModule<Public, Q22Private> = {
	metadata: {
		slot: 22,
		key: 'the-alibi',
		title: 'The Alibi',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The log has no names. Find Daniel in the card register first, and read every column of his rows.',
		},
		{
			order: 2,
			text: 'His first card was reported lost; the replacement is the one that moves that night. Find the door it opens before 02:41 and leaves after it.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q22Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const cards = new Set<string>();
		while (cards.size < STAFF.length + 2) cards.add(`C-${await ctx.rng.string(4, ALPHABETS.digits)}`);
		const [lost, replacement, ...staffCards] = [...cards];
		const register: [string, string, string][] = [
			[lost, 'REYES, D. (contractor)', 'Reported lost 2015-09-28. Suspended.'],
			[replacement, 'REYES, D. (contractor)', 'Replacement issued 2015-09-29.'],
			...STAFF.map((name, i): [string, string, string] => [staffCards[i], name, name === 'GULL, H.' ? 'Caretaker' : 'Staff']),
		];
		register.sort((a, b) => a[0].localeCompare(b[0]));

		const room = await ctx.rng.choice(ROOMS);
		const doors = ['MAIN ENTRANCE', ...ROOMS];
		const log: [string, string, string, string][] = [];
		// Two night staff patrol every door; nobody but Daniel is in his room at 02:41.
		for (const guard of staffCards.slice(0, 2)) {
			for (let m = await ctx.rng.int(0, 30); m < 480; m += 35 + (await ctx.rng.int(0, 25))) {
				const door = await ctx.rng.choice(doors);
				if (door === room && m > 250 && m < 290) continue;
				log.push([at(m), guard, door, 'IN']);
				log.push([at(m + 2 + (await ctx.rng.int(0, 4))), guard, door, 'OUT']);
			}
		}
		for (const other of staffCards.slice(2, 5)) {
			const door = await ctx.rng.choice(ROOMS.filter((r) => r !== room));
			const m = 240 + (await ctx.rng.int(0, 60));
			log.push([at(m), other, 'MAIN ENTRANCE', 'IN'], [at(m + 3), other, door, 'IN'], [at(m + 30), other, door, 'OUT'], [at(m + 33), other, 'MAIN ENTRANCE', 'OUT']);
		}
		log.push([at(110 + (await ctx.rng.int(0, 20))), lost, 'MAIN ENTRANCE', 'DENIED — CARD SUSPENDED']);
		const entry = 256 + (await ctx.rng.int(0, 5));
		log.push(
			[at(entry), replacement, 'MAIN ENTRANCE', 'IN'],
			[at(entry + 4), replacement, room, 'IN'],
			[at(283 + (await ctx.rng.int(0, 4))), replacement, room, 'OUT'],
			[at(290), replacement, 'MAIN ENTRANCE', 'OUT'],
		);
		log.sort((a, b) => a[0].localeCompare(b[0]));

		const prompt = [
			'ALIBI RECONSTRUCTION — DANIEL REYES',
			'',
			'The audit log (Q21) puts the overwrite of MEMO-published.html at',
			'2015-10-03 02:41.',
			'',
			'Daniel\'s statement to the Bureau:',
			'  "I took the overnight coach from Caldwell at 23:00 on 2 October and',
			'   reached my flat in Thornfield at about 03:15. I was nowhere near',
			'   the estate."',
			'',
			'Coach manifest, route CN-7:  D. REYES — seat 14B — booked.',
			'                             Boarding: not recorded.',
			'',
			'The estate door controller exports swipes by card number, not by name.',
			'Evidence:  access-log.csv   card-register.csv',
			'',
			'Where in the building was Daniel when the file was overwritten?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: room, register, log },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer.replace(/\s+/g, ' '), instance.privateData.answer);
	},

	artifact(instance, name) {
		const p = instance.privateData;
		if (name === 'access-log.csv') {
			return { body: ['timestamp,card,door,result', ...p.log.map((r) => r.join(','))].join('\n') + '\n', contentType: CSV };
		}
		if (name === 'card-register.csv') {
			return { body: ['card,holder,note', ...p.register.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n') + '\n', contentType: CSV };
		}
		return null;
	},
};

export default challenge;
