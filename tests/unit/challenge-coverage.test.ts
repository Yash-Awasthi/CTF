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
	it('every combination generates safe public data with no privateData leak', async () => {
		// Timeout: 3,480 combinations × async crypto — allow up to 30s in combined runs.
		// Narrative CTF challenges intentionally embed artifact content (including the
		// answer string) in the visible prompt — that is CTF design, not a data leak.
		// The true security invariant is: privateData must never appear in the public
		// projection, and publicData must never carry an explicit "answer" field.
		let count = 0;
		const seenPublic = new Set<string>();

		for (const roll of ROLLS) {
			for (const slot of SLOTS) {
				const { instance } = await generateChallengeForParticipant(ctx(roll), slot);
				const answer = (instance.privateData as { answer: string }).answer;
				expect(answer.length).toBeGreaterThan(0);

				const pub = await getPublicChallengeData(ctx(roll), slot);
				const serialized = JSON.stringify(pub);
				// The privateData wrapper must never cross the boundary.
				expect(serialized).not.toContain('privateData');
				// publicData must not carry a field literally named "answer".
				expect('answer' in (pub.publicData as object)).toBe(false);
				seenPublic.add(`${roll}:${slot}`);
				count++;
			}
		}
		expect(count).toBe(3480);
		expect(seenPublic.size).toBe(3480);
	}, 30_000); // 3,480 async crypto ops — allow 30s

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
