import { describe, expect, it } from 'vitest';
import {
	generateChallengeForParticipant,
	getPublicChallengeData,
	validateChallengeAnswer,
	getChallengeHints,
	type EngineContext,
} from '../../src/lib/challenges/engine';
import { getChallengeBySlot } from '../../src/lib/challenges/registry';
import { ATTRIBUTION_SLOTS } from '../../src/lib/challenges/placeholders';

const ENV = { EVENT_SECRET: 'phase5-test-secret-DO-NOT-USE-00000000' };
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);

function ctx(rollNumber: number): EngineContext {
	return { env: ENV, event: EVENT, rollNumber, roster: ROLLS };
}

/** Fetch a participant's correct answer via the private instance (test-only). */
async function correctAnswer(rollNumber: number, slot: number): Promise<string> {
	const { instance } = await generateChallengeForParticipant(ctx(rollNumber), slot);
	return (instance.privateData as { answer: string }).answer;
}

describe('deterministic generation', () => {
	it('same participant+slot → identical instance across fresh calls', async () => {
		const a = await generateChallengeForParticipant(ctx(25_115_000), 3);
		const b = await generateChallengeForParticipant(ctx(25_115_000), 3);
		expect(a.instance).toEqual(b.instance);
	});

	it('different slot → different personalization', async () => {
		const a = await getPublicChallengeData(ctx(25_115_000), 3);
		const b = await getPublicChallengeData(ctx(25_115_000), 4);
		expect(a.publicData).not.toEqual(b.publicData);
	});

	it('different participant → different ordinary answer', async () => {
		// slot 3 is ordinary (not in ATTRIBUTION_SLOTS)
		expect(ATTRIBUTION_SLOTS).not.toContain(3);
		const a = await correctAnswer(25_115_000, 3);
		const b = await correctAnswer(25_115_001, 3);
		expect(a).not.toBe(b);
	});
});

describe('validation', () => {
	it('correct participant-specific answer validates', async () => {
		const ans = await correctAnswer(25_115_005, 2);
		const r = await validateChallengeAnswer(ctx(25_115_005), 2, ans);
		expect(r.correct).toBe(true);
	});

	it('wrong answer fails', async () => {
		const r = await validateChallengeAnswer(ctx(25_115_005), 2, 'definitely-wrong');
		expect(r.correct).toBe(false);
	});

	it('normalization applied (case/whitespace insensitive)', async () => {
		const ans = await correctAnswer(25_115_005, 2);
		const r = await validateChallengeAnswer(ctx(25_115_005), 2, `  ${ans.toUpperCase()}  `);
		expect(r.correct).toBe(true);
	});

	it("participant A's ordinary answer is not valid for participant B", async () => {
		const ansA = await correctAnswer(25_115_010, 3);
		const r = await validateChallengeAnswer(ctx(25_115_011), 3, ansA);
		expect(r.correct).toBe(false);
	});
});

describe('hints', () => {
	it('exactly two hints per slot, not in public data', async () => {
		const hints = getChallengeHints(5);
		expect(hints).toHaveLength(2);
		const pub = await getPublicChallengeData(ctx(25_115_000), 5);
		expect(JSON.stringify(pub)).not.toContain(hints[0].text);
	});
});

describe('public/private boundary', () => {
	const FORBIDDEN = 'answer';
	it('public data never contains the correct answer or privateData', async () => {
		for (const slot of [1, 8, 15, 16, 30]) {
			const ans = await correctAnswer(25_115_003, slot);
			const pub = await getPublicChallengeData(ctx(25_115_003), slot);
			const serialized = JSON.stringify(pub);
			expect(serialized).not.toContain(ans);
			expect(serialized).not.toContain('privateData');
			expect(Object.keys(pub)).not.toContain('privateData');
			// public projection exposes only the known safe keys
			expect(Object.keys(pub).sort()).toEqual(
				['attributionEnabled', 'basePoints', 'key', 'publicData', 'slot', 'tier', 'title'].sort(),
			);
			expect(FORBIDDEN in (pub.publicData as object)).toBe(false);
		}
	});
});

describe('generation does not depend on DB row id', () => {
	it('module contract has no id input; identity is slot only', () => {
		// The generation context type carries slot + rollNumber, never a DB id.
		const m = getChallengeBySlot(1)!;
		expect(m.metadata.slot).toBe(1);
		expect('id' in m.metadata).toBe(false);
	});
});
