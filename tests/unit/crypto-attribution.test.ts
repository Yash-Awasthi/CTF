import { describe, expect, it } from 'vitest';
import { utf8 } from '../../src/lib/crypto/encoding';
import { deriveEventKey } from '../../src/lib/crypto/derive';
import {
	AttributionError,
	assignAttributionAnswers,
	buildOwnershipMap,
	validateAttributionPool,
} from '../../src/lib/crypto/attribution';

const SECRET = utf8('test-vector-secret-DO-NOT-USE-0000');
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };

const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);
// 116 unique attribution answers.
const ANSWERS = Array.from({ length: 116 }, (_, i) => `Detective-${i}`);

async function eventKey() {
	return deriveEventKey(SECRET, EVENT);
}

describe('attribution bijection', () => {
	it('116 participants + 116 unique answers → complete bijection', async () => {
		const ek = await eventKey();
		const asg = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		expect(asg).toHaveLength(116);
		// every participant exactly once
		expect(new Set(asg.map((a) => a.rollNumber)).size).toBe(116);
		// every answer exactly once
		expect(new Set(asg.map((a) => a.normalizedAnswer)).size).toBe(116);
		// answers all drawn from the pool
		const pool = new Set(ANSWERS.map((a) => a.trim().toLowerCase()));
		for (const a of asg) expect(pool.has(a.normalizedAnswer)).toBe(true);
	});

	it('repeated assignment is identical', async () => {
		const ek = await eventKey();
		const a = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		const b = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		expect(a).toEqual(b);
	});

	it('changed challenge slot changes the mapping', async () => {
		const ek = await eventKey();
		const a = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		const b = await assignAttributionAnswers(ek, 13, ROLLS, ANSWERS);
		expect(a).not.toEqual(b);
	});

	it('input order is canonicalized (roll ascending) regardless of caller order', async () => {
		const ek = await eventKey();
		const shuffledRolls = [...ROLLS].reverse();
		const a = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		const b = await assignAttributionAnswers(ek, 12, shuffledRolls, ANSWERS);
		expect(a).toEqual(b);
	});
});

describe('attribution pool validation', () => {
	it('insufficient pool fails', () => {
		expect(() => validateAttributionPool(ROLLS, ANSWERS.slice(0, 100))).toThrow(
			AttributionError,
		);
	});

	it('duplicate normalized answers fail (TOM/tom/ Tom )', () => {
		const dup = ['TOM', 'tom', ' Tom ', 'x'];
		expect(() => validateAttributionPool([1, 2, 3, 4], dup)).toThrow(
			AttributionError,
		);
	});

	it('empty normalized answers fail', () => {
		expect(() => validateAttributionPool([1, 2], ['a', '   '])).toThrow(
			AttributionError,
		);
	});

	it('duplicate roll numbers fail', () => {
		expect(() => validateAttributionPool([1, 1], ['a', 'b'])).toThrow(
			AttributionError,
		);
	});

	it('assignAttributionAnswers rejects an invalid pool before running', async () => {
		const ek = await eventKey();
		await expect(
			assignAttributionAnswers(ek, 1, ROLLS, ANSWERS.slice(0, 50)),
		).rejects.toThrow(AttributionError);
	});
});

describe('ownership map', () => {
	it('maps normalized answer → owning roll number, one owner each', async () => {
		const ek = await eventKey();
		const asg = await assignAttributionAnswers(ek, 12, ROLLS, ANSWERS);
		const owners = buildOwnershipMap(asg);
		expect(owners.size).toBe(116);
		for (const a of asg) {
			expect(owners.get(a.normalizedAnswer)).toBe(a.rollNumber);
		}
	});
});

describe('normalization uniqueness across all 116 participants', () => {
	it('every attribution-enabled pool is unique post-normalization', async () => {
		const ek = await eventKey();
		// Answers that differ only by case/whitespace would collapse — assert our
		// pool survives normalization AND assignment stays unique.
		const asg = await assignAttributionAnswers(ek, 5, ROLLS, ANSWERS);
		const norms = asg.map((a) => a.normalizedAnswer);
		expect(new Set(norms).size).toBe(norms.length);
	});
});
