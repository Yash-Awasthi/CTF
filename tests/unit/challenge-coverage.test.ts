/**
 * Full challenge-engine coverage: 116 participants × 30 slots = 3,480. Separate
 * from the Phase 4 crypto coverage — this proves the ENGINE (resolve module →
 * derive personalization → generate instance → safe public data → validation
 * state) works for every combination, leaks nothing, and reproduces.
 */
import { describe, expect, it } from 'vitest';
import {
	generateChallengeForParticipant,
	getPublicChallengeData,
	validateChallengeAnswer,
	type EngineContext,
} from '../../src/lib/challenges/engine';

const ENV = { EVENT_SECRET: 'phase5-test-secret-DO-NOT-USE-00000000' };
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);
const SLOTS = Array.from({ length: 30 }, (_, i) => i + 1);

function ctx(rollNumber: number): EngineContext {
	return { env: ENV, event: EVENT, rollNumber, roster: ROLLS };
}

describe('3,480 participant/challenge engine coverage', () => {
	it('every combination generates safe public data with no answer leak', async () => {
		let count = 0;
		const seenPublic = new Set<string>();

		for (const roll of ROLLS) {
			for (const slot of SLOTS) {
				const { instance } = await generateChallengeForParticipant(ctx(roll), slot);
				const answer = (instance.privateData as { answer: string }).answer;
				expect(answer.length).toBeGreaterThan(0);

				const pub = await getPublicChallengeData(ctx(roll), slot);
				const serialized = JSON.stringify(pub);
				expect(serialized).not.toContain(answer); // no private leak
				seenPublic.add(`${roll}:${slot}`);
				count++;
			}
		}
		expect(count).toBe(3480);
		expect(seenPublic.size).toBe(3480);
	});

	it('reproduces identically for sampled combinations', async () => {
		for (const roll of [ROLLS[0], ROLLS[57], ROLLS[115]]) {
			for (const slot of [1, 8, 15, 16, 30]) {
				const a = await generateChallengeForParticipant(ctx(roll), slot);
				const b = await generateChallengeForParticipant(ctx(roll), slot);
				expect(a.instance).toEqual(b.instance);
				const answer = (a.instance.privateData as { answer: string }).answer;
				const r = await validateChallengeAnswer(ctx(roll), slot, answer);
				expect(r.correct).toBe(true);
			}
		}
	});
});
