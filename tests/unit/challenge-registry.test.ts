import { describe, expect, it } from 'vitest';
import {
	getAllChallenges,
	getChallengeBySlot,
	getChallengeByKey,
	validateChallengeRegistry,
	TOTAL_SLOTS,
} from '../../src/lib/challenges/registry';
import { RegistryError } from '../../src/lib/challenges/errors';
import type { ChallengeModule } from '../../src/lib/challenges/types';

const base = getAllChallenges()[0];

/** Clone a valid module with metadata overrides for negative tests. */
function mutate(over: Partial<ChallengeModule['metadata']>): ChallengeModule {
	return { ...base, metadata: { ...base.metadata, ...over } };
}

describe('registry invariants', () => {
	it('registers exactly 30 slots, 1..30, no gaps', () => {
		const all = getAllChallenges();
		expect(all).toHaveLength(TOTAL_SLOTS);
		expect(all.map((m) => m.metadata.slot)).toEqual(
			Array.from({ length: 30 }, (_, i) => i + 1),
		);
	});

	it('no duplicate slots or keys', () => {
		const all = getAllChallenges();
		expect(new Set(all.map((m) => m.metadata.slot)).size).toBe(30);
		expect(new Set(all.map((m) => m.metadata.key)).size).toBe(30);
	});

	it('all titles non-empty, base points positive, exactly two hints', () => {
		for (const m of getAllChallenges()) {
			expect(m.metadata.title.length).toBeGreaterThan(0);
			expect(m.metadata.basePoints).toBeGreaterThan(0);
			expect(Number.isInteger(m.metadata.basePoints)).toBe(true);
			expect(m.hints).toHaveLength(2);
			expect(m.hints[0].order).toBe(1);
			expect(m.hints[1].order).toBe(2);
		}
	});

	it('self-validation passes on the real registry', () => {
		expect(() => validateChallengeRegistry()).not.toThrow();
	});
});

describe('registry lookups', () => {
	it('get by slot / key works', () => {
		const m = getChallengeBySlot(1)!;
		expect(m.metadata.slot).toBe(1);
		expect(getChallengeByKey(m.metadata.key)).toBe(m);
	});

	it('unknown slot / key fail safely (undefined, no throw)', () => {
		expect(getChallengeBySlot(31)).toBeUndefined();
		expect(getChallengeBySlot(0)).toBeUndefined();
		expect(getChallengeByKey('does-not-exist')).toBeUndefined();
	});
});

describe('registry rejects invalid metadata', () => {
	it('wrong count', () => {
		expect(() => validateChallengeRegistry([base])).toThrow(RegistryError);
	});
	it('duplicate slot', () => {
		const dup = getAllChallenges();
		dup[1] = mutate({ slot: 1, key: 'x' });
		expect(() => validateChallengeRegistry(dup)).toThrow(RegistryError);
	});
	it('duplicate key', () => {
		const dup = getAllChallenges();
		dup[1] = mutate({ key: base.metadata.key });
		expect(() => validateChallengeRegistry(dup)).toThrow(RegistryError);
	});
	it('empty title / non-positive points / bad slot', () => {
		const all = getAllChallenges();
		expect(() => validateChallengeRegistry([...all.slice(1), mutate({ title: '' })])).toThrow(RegistryError);
		expect(() => validateChallengeRegistry([...all.slice(1), mutate({ basePoints: 0 })])).toThrow(RegistryError);
		expect(() => validateChallengeRegistry([...all.slice(1), mutate({ slot: 99 })])).toThrow(RegistryError);
	});
});
