/**
 * Q10 — The Sitter
 *
 * Doll #6 (Lot 47, VALE-M-1882-047) is compared against the six photographs that
 * survive from the 1978 Pembridge missing-persons register. Three marks painted on
 * the doll (a mole, a scar through one eyebrow, the side of the hair parting) match
 * exactly one photograph; each other photograph differs in exactly one mark.
 *
 * Artifacts (served by /{event}/evidence/10/{name}):
 *   doll.svg     — Mira's April 2015 catalogue photograph of the doll
 *   register.svg — the six 1978 register photographs with their file numbers
 * Personalized: marks, lineup order, looks and file numbers all come from ctx.rng.
 * Answer: the matching file number (MP-78-NNNN). It appears only as one of six
 * labels in the register image, never in page text.
 *
 * Q29 contribution: the register skips entry 071 (the case number) with no annotation.
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';
import {
	MOLES, SCARS, PARTINGS, PHOTO_DEFS, portrait, sameMarks,
	type FaceMarks, type FaceLook,
} from '../shared/portrait';

interface Public {
	prompt: string;
	token: string;
}
export interface Q10Entry {
	register: number;
	file: string;
	marks: FaceMarks;
	look: FaceLook;
}
export interface Q10Private {
	answer: string;
	doll: FaceMarks;
	entries: Q10Entry[];
}

const SKINS = ['#e6c3a5', '#d9b08c', '#c99a78', '#ecd0b8', '#b88462'];
const HAIRS = ['#2a1d14', '#5a3a22', '#8a6a3a', '#1c1c1c', '#6e4a30', '#a07850'];
const SVG = 'image/svg+xml; charset=utf-8';

export function buildRegisterSvg(entries: readonly Q10Entry[]): string {
	const cells = entries.map((e, i) => {
		const x = 30 + (i % 3) * 290;
		const y = 70 + Math.floor(i / 3) * 330;
		return `<g><rect x="${x}" y="${y}" width="270" height="310" fill="#e9e1cf" stroke="#9a8c70"/>`
			+ `<clipPath id="f${i}"><rect x="${x + 15}" y="${y + 15}" width="240" height="240"/></clipPath>`
			+ `<g filter="url(#sepia)" clip-path="url(#f${i})"><rect x="${x + 15}" y="${y + 15}" width="240" height="240" fill="#bfb49a"/>`
			+ portrait(x + 135, y + 118, 1.15, e.marks, e.look) + `</g>`
			+ `<rect x="${x + 15}" y="${y + 15}" width="240" height="240" fill="none" stroke="#6a5e48"/>`
			+ `<text x="${x + 20}" y="${y + 280}" font-family="Courier New, monospace" font-size="13" fill="#3a3020">REG ${String(e.register).padStart(3, '0')}</text>`
			+ `<text x="${x + 20}" y="${y + 298}" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#2a2018">${e.file}</text></g>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 740" width="900" height="740">${PHOTO_DEFS}
<rect width="900" height="740" fill="#d8cfbb"/>
<text x="30" y="36" font-family="Georgia, serif" font-size="20" fill="#2a2018">PEMBRIDGE CONSTABULARY — MISSING PERSONS REGISTER, 1978</text>
<text x="30" y="58" font-family="Courier New, monospace" font-size="12" fill="#5a4e38">Entries 066–076 · surviving photographs only · entry 071 not present in register</text>
${cells.join('\n')}
</svg>`;
}

export function buildDollSvg(marks: FaceMarks): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="620" height="620">
<clipPath id="frame"><rect x="30" y="30" width="560" height="480"/></clipPath>
<rect width="620" height="620" fill="#1d1a17"/>
<g clip-path="url(#frame)"><rect x="30" y="30" width="560" height="480" fill="#3b332c"/>
${portrait(310, 250, 2.2, marks, { skin: '#f3e6dc', hair: '#3a2418', width: 1.02, doll: true })}</g>
<text x="30" y="548" font-family="Courier New, monospace" font-size="15" fill="#cbbfa8">VALE COLLECTION · DOLL #6 · LOT 47 · VALE-M-1882-047</text>
<text x="30" y="572" font-family="Courier New, monospace" font-size="13" fill="#8a7e68">Fired porcelain, painted features · photographed by M. Castellan, 04/2015</text>
<text x="30" y="596" font-family="Courier New, monospace" font-size="13" fill="#8a7e68">Maker's note, underside: "from life"</text>
</svg>`;
}

const challenge: ChallengeModule<Public, Q10Private> = {
	metadata: {
		slot: 10,
		key: 'doll-number-six',
		title: 'The Sitter',
		tier: 'medium',
		basePoints: 150,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Hair colour, face shape and skin tone vary between photographs, and the doll is porcelain. Look for marks a maker would only paint if copying a real face.',
		},
		{
			order: 2,
			text: 'There are three marks: a mole, a pale scar through one eyebrow, and which side the hair is parted. Five photographs differ from the doll in exactly one of them.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Q10Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);
		const doll: FaceMarks = {
			mole: await ctx.rng.choice(MOLES.filter((m) => m !== 'none')),
			scar: await ctx.rng.choice(SCARS.filter((m) => m !== 'none')),
			parting: await ctx.rng.choice(PARTINGS),
		};
		// Decoys each change exactly one mark, so every mark has to be checked.
		const variants: FaceMarks[] = [
			...MOLES.filter((m) => m !== doll.mole).map((mole) => ({ ...doll, mole })),
			...SCARS.filter((m) => m !== doll.scar).map((scar) => ({ ...doll, scar })),
			...PARTINGS.filter((m) => m !== doll.parting).map((parting) => ({ ...doll, parting })),
		];
		const marks = await ctx.rng.shuffle([doll, ...(await ctx.rng.sample(variants, 5))]);
		const registers = (await ctx.rng.sample([66, 67, 68, 69, 70, 72, 73, 74, 75, 76], 6)).sort((a, b) => a - b);
		const files = new Set<string>();
		while (files.size < 6) files.add(`MP-78-${await ctx.rng.string(4, ALPHABETS.digits)}`);
		const fileList = [...files];
		const entries: Q10Entry[] = [];
		for (let i = 0; i < 6; i++) {
			entries.push({
				register: registers[i],
				file: fileList[i],
				marks: marks[i],
				look: {
					skin: await ctx.rng.choice(SKINS),
					hair: await ctx.rng.choice(HAIRS),
					width: 0.9 + (await ctx.rng.int(0, 21)) / 100,
				},
			});
		}
		const answer = entries.find((e) => sameMarks(e.marks, doll))!.file;

		const prompt = [
			'VALE COLLECTION — DOLL #6 (LOT 47, VALE-M-1882-047)',
			'',
			'Mira photographed Doll #6 for the Vale catalogue in April 2015.',
			'Beside the photograph she wrote: "Not a type. A person. Find her."',
			'The maker\'s note on the underside reads: "from life".',
			'',
			'The Q9 archive also held a copy of the 1978 Pembridge missing-persons',
			'register — the year the doll surfaced in a private collection.',
			'Entries 066 to 076 were retrieved. Six photographs survive.',
			'Entry 071 is absent from the register. No annotation explains the gap.',
			'',
			'Evidence:',
			'  doll.svg      — catalogue photograph of Doll #6',
			'  register.svg  — the six surviving register photographs',
			'',
			'Compare the doll against every photograph.',
			'Which missing-person file is the woman the doll was made from?',
			'(Format: MP-78-NNNN)',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer, doll, entries },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},

	artifact(instance, name) {
		if (name === 'doll.svg') return { body: buildDollSvg(instance.privateData.doll), contentType: SVG };
		if (name === 'register.svg') return { body: buildRegisterSvg(instance.privateData.entries), contentType: SVG };
		return null;
	},
};

export default challenge;
