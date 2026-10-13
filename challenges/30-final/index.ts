/**
 * Q30 — The Subject
 *
 * The final terminal. After Q29 the interface strips Blackwood branding and shows
 * a THE CONTINUITY shell holding the current record, sealed: its first line is
 * printed in clear, the whole record is given as hex XORed with a repeating key
 * shorter than that line. The clear line is the crib that recovers the key.
 *
 * Unsealed, the record names the SUBJECT, the participant's own codename (assigned
 * silently at Q1, visible only in small UI chrome), and the WITNESS: the man
 * currently answering to "Daniel Reyes", whose real name appears nowhere else.
 * Answer: SUBJECT / WITNESS. Neither half can be guessed for the other.
 *
 * The codename is derived from getCodename(rollNumber), the same formula as Q1.
 * Personalized: key, key length and the current Daniel's name, from ctx.rng.
 * Q29 contribution: none (this IS the payoff)
 * Mutable: no
 */
import { ALPHABETS } from '../../src/lib/crypto/constants';
import { getCodename } from '../shared/codenames';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
export interface Q30Private {
	answer: string;
	codename: string;
	witness: string;
}

export const HEADER = 'CONTINUITY RECORD: CURRENT';
const FIRST = ['ARTHUR', 'HAROLD', 'LEONARD', 'WALTER', 'GRAHAM', 'COLIN', 'MARTIN', 'EDMUND', 'SIMON', 'FELIX', 'OWEN', 'JULIAN'];
const LAST = ['ASHBY', 'BRENNAN', 'CROFT', 'DALLOWAY', 'FENWICK', 'GARROD', 'HOLLIS', 'KEMBLE', 'LOWRY', 'OAKES', 'PRYCE', 'SAXBY', 'TALBOT'];

export function record(codename: string, witness: string): string {
	return [
		HEADER,
		'CYCLE: VI',
		'COLLECTOR: BLACKWOOD ARCHIVE',
		`SUBJECT: ${codename}`,
		`INVESTIGATOR: ${codename}`,
		`WITNESS: DANIEL REYES (CURRENT INSTANCE: ${witness})`,
		'SUCCESSOR: PENDING',
		'NOTE: THE SUBJECT IS ALWAYS THE LAST PERSON TO READ THE FILE.',
	].join('\n');
}

export function xor(bytes: Uint8Array, key: Uint8Array): Uint8Array {
	return bytes.map((b, i) => b ^ key[i % key.length]);
}

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]+/g, ' ').trim();

const challenge: ChallengeModule<Public, Q30Private> = {
	metadata: {
		slot: 30,
		key: 'the-subject',
		title: 'The Subject',
		tier: 'capstone',
		basePoints: 600,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'The record is sealed with a short key used over and over. You already have the start of the plaintext.',
		},
		{
			order: 2,
			text: 'XOR the clear first line against the first bytes of the hex to get the key stream, find where it repeats, then unseal the rest. One of the names is your own Q1 codename.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q30Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const codename = getCodename(ctx.rollNumber);
		const witness = `${await ctx.rng.choice(FIRST)} ${await ctx.rng.choice(LAST)}`;
		const key = await ctx.rng.bytes(7 + (await ctx.rng.int(0, 7)));
		const sealed = xor(new TextEncoder().encode(record(codename, witness)), key);
		const hex = Array.from(sealed, (b) => b.toString(16).padStart(2, '0'));
		const lines: string[] = [];
		for (let i = 0; i < hex.length; i += 24) lines.push(`  ${hex.slice(i, i + 24).join(' ')}`);

		const prompt = [
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'  THE CONTINUITY',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'',
			HEADER,
			`[RECORD SEALED — ${sealed.length} BYTES, KEY SHORTER THAN THIS LINE]`,
			'',
			...lines,
			'',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
			'',
			'FINAL QUERY',
			'',
			'IDENTIFY THE SUBJECT AND THE WITNESS.',
			'(Format: SUBJECT / WITNESS)',
			'',
			'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: `${codename} / ${witness}`, codename, witness },
		};
	},

	validate(instance, normalizedAnswer) {
		const { codename, witness } = instance.privateData;
		const got = clean(normalizedAnswer.replace(/daniel reyes|current instance/g, ' '));
		return { correct: got === clean(`${codename} ${witness}`) || got === clean(`${witness} ${codename}`) };
	},
};

export default challenge;
