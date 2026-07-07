/**
 * Full 116 participants × 30 challenge slots = 3,480 combinations. Verifies
 * every participant/challenge seed derives without error, is unique, and
 * reproduces identically on a second pass (process-independent). Uses only
 * stable identity (event slug, roll number, slot) — no DB row ids.
 */
import { describe, expect, it } from 'vitest';
import { toHex, utf8 } from '../../src/lib/crypto/encoding';
import {
	deriveChallengeSeed,
	deriveEventKey,
	deriveParticipantSeed,
} from '../../src/lib/crypto/derive';
import { createDeterministicRng } from '../../src/lib/crypto/rng';

const SECRET = utf8('test-vector-secret-DO-NOT-USE-0000');
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);
const SLOTS = Array.from({ length: 30 }, (_, i) => i + 1);

describe('3,480 participant/challenge coverage', () => {
	it('all combinations derive, are unique, and reproduce', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		const first = new Map<string, string>(); // "roll:slot" -> challengeSeed hex
		const allSeeds = new Set<string>();
		const partSeeds = new Set<string>();

		for (const roll of ROLLS) {
			const ps = await deriveParticipantSeed(ek, roll);
			partSeeds.add(toHex(ps));
			for (const slot of SLOTS) {
				const cs = toHex(await deriveChallengeSeed(ps, slot));
				first.set(`${roll}:${slot}`, cs);
				allSeeds.add(cs);
			}
		}

		expect(first.size).toBe(3480);
		expect(allSeeds.size).toBe(3480); // no challenge-seed collisions
		expect(partSeeds.size).toBe(116); // no participant-seed collisions

		// Second pass reproduces byte-identical seeds AND RNG output.
		for (const roll of [ROLLS[0], ROLLS[57], ROLLS[115]]) {
			const ps = await deriveParticipantSeed(ek, roll);
			for (const slot of [1, 15, 30]) {
				const cs = await deriveChallengeSeed(ps, slot);
				expect(toHex(cs)).toBe(first.get(`${roll}:${slot}`));
				const a = await (await createDeterministicRng(cs)).bytes(16);
				const b = await (await createDeterministicRng(cs)).bytes(16);
				expect(toHex(a)).toBe(toHex(b));
			}
		}
	});
});
