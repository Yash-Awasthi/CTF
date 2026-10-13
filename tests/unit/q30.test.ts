/**
 * Q30 — The Subject
 * Personalized answer: SUBJECT (codename, same as Q1) / WITNESS (current Daniel), from a sealed record.
 * Formula: getCodename(rollNumber) — stride-37 permutation over 200-name pool.
 * Q29 contribution: none (this IS the payoff).
 */
import { describe, expect, it } from 'vitest';
import {
	generateChallengeForParticipant,
	validateChallengeAnswer,
	getChallengeHints,
	type EngineContext,
} from '../../src/lib/challenges/engine';
import { getChallengeBySlot, getChallengeByKey } from '../../src/lib/challenges/registry';
import { getChallengeAccessStatus } from '../../src/lib/challenges/access';
import { getCodename, CODENAME_POOL } from '../../challenges/shared/codenames';
import { HEADER, type Q30Private } from '../../challenges/30-final/index';

const ENV   = { EVENT_SECRET: 'q30-test-secret-DO-NOT-USE-00000000000' };
const EVENT = { slug: 'case-71c-test', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);
function ctx(r: number): EngineContext { return { env: ENV, event: EVENT, rollNumber: r, roster: ROLLS }; }
const SLOT = 30;

describe('Q30 registration', () => {
	it('slot 30', () => { expect(getChallengeBySlot(SLOT)!.metadata.slot).toBe(30); });
	it('key "the-subject"', () => { expect(getChallengeBySlot(SLOT)!.metadata.key).toBe('the-subject'); });
	it('title "The Subject"', () => { expect(getChallengeBySlot(SLOT)!.metadata.title).toBe('The Subject'); });
	it('tier "capstone"', () => { expect(getChallengeBySlot(SLOT)!.metadata.tier).toBe('capstone'); });
	it('basePoints 600', () => { expect(getChallengeBySlot(SLOT)!.metadata.basePoints).toBe(600); });
	it('attributionEnabled false', () => { expect(getChallengeBySlot(SLOT)!.metadata.attributionEnabled).toBe(false); });
	it('retrievable by key', () => { expect(getChallengeByKey('the-subject')!.metadata.slot).toBe(30); });
});

describe('Q30 codename derivation', () => {
	it('getCodename uses stride-37 permutation over 200-name pool', () => {
		// Verify the formula: idx = ((rollNumber - 1) * 37) % 200
		const roll = ROLLS[0];
		const expectedIdx = ((roll - 1) * 37) % CODENAME_POOL.length;
		expect(getCodename(roll)).toBe(CODENAME_POOL[expectedIdx]);
	});
	it('CODENAME_POOL has 195 entries', () => {
		expect(CODENAME_POOL).toHaveLength(195);
	});
	it('all pool entries are uppercase strings', () => {
		CODENAME_POOL.forEach(name => {
			expect(name).toMatch(/^[A-Z]+$/);
		});
	});
	it('pool has 195 unique entries', () => {
		expect(new Set(CODENAME_POOL).size).toBe(195);
	});
	it('consecutive rolls map to non-adjacent codenames (stride effect)', () => {
		const a = getCodename(ROLLS[0]);
		const b = getCodename(ROLLS[1]);
		// Different rolls → different codenames (for small CTF roster)
		expect(a).not.toBe(b);
	});
	it('same roll always produces same codename', () => {
		const roll = ROLLS[42];
		expect(getCodename(roll)).toBe(getCodename(roll));
	});
});

const priv = async (r: number) => (await generateChallengeForParticipant(ctx(r), SLOT)).instance.privateData as Q30Private;
const promptOf = async (r: number) => ((await generateChallengeForParticipant(ctx(r), SLOT)).instance.publicData as { prompt: string }).prompt;

/** Solve as a player: crib the clear header against the hex, find the period, unseal. */
function unseal(prompt: string): string {
	const hex = prompt.split('\n').filter((l) => /^ {2}([0-9a-f]{2} ?)+$/.test(l)).join(' ').trim().split(/\s+/);
	const bytes = Uint8Array.from(hex, (h) => parseInt(h, 16));
	const stream = [...HEADER].map((c, i) => c.charCodeAt(0) ^ bytes[i]);
	const period = Array.from({ length: stream.length }, (_, k) => k + 1).find((k) => stream.every((v, i) => i < k || v === stream[i - k]))!;
	return new TextDecoder().decode(bytes.map((b, i) => b ^ stream[i % period]));
}

describe('Q30 personalized answer', () => {
	it('subject is getCodename(rollNumber), the same as Q1', async () => {
		for (const r of [ROLLS[0], ROLLS[3]]) expect((await priv(r)).codename).toBe(getCodename(r));
	});
	it('the sealed record unseals from its clear header to the subject and witness, for every participant', async () => {
		for (const r of ROLLS) {
			const prompt = await promptOf(r);
			const p = await priv(r);
			const text = unseal(prompt);
			expect(text.startsWith(HEADER)).toBe(true);
			expect(text).toContain(`SUBJECT: ${p.codename}`);
			expect(text).toContain(`CURRENT INSTANCE: ${p.witness}`);
			expect(prompt).not.toContain(p.codename);
			expect(prompt).not.toContain(p.witness);
		}
	});
	it('same roll produces the same instance', async () => {
		expect(await promptOf(ROLLS[7])).toBe(await promptOf(ROLLS[7]));
	});
});

describe('Q30 prompt content', () => {
	it('shows THE CONTINUITY header, the clear first line and the final query', async () => {
		const prompt = await promptOf(ROLLS[0]);
		expect(prompt).toContain('THE CONTINUITY');
		expect(prompt).toContain(HEADER);
		expect(prompt).toContain('FINAL QUERY');
		expect(prompt).toContain('IDENTIFY THE SUBJECT AND THE WITNESS');
		expect(prompt).toContain('━━━');
	});
	it('prompts differ between participants', async () => {
		expect(new Set(await Promise.all(ROLLS.slice(0, 5).map(promptOf))).size).toBe(5);
	});
});

describe('Q30 validation', () => {
	it('accepts subject and witness in either order and any separator', async () => {
		const r = ROLLS[0];
		const { codename, witness } = await priv(r);
		for (const a of [`${codename} / ${witness}`, `  ${codename.toLowerCase()}, ${witness.toLowerCase()} `, `${witness} / ${codename}`, `${codename} / Daniel Reyes (current instance: ${witness})`]) {
			expect((await validateChallengeAnswer(ctx(r), SLOT, a)).correct).toBe(true);
		}
	});
	it('rejects the codename alone, the witness alone, or another participant', async () => {
		const r = ROLLS[4];
		const { codename, witness } = await priv(r);
		for (const a of [codename, witness, '', `${getCodename(ROLLS[99])} / ${witness}`, 'THE CONTINUITY', 'MIRA CASTELLAN / DANIEL REYES']) {
			expect((await validateChallengeAnswer(ctx(r), SLOT, a)).correct).toBe(false);
		}
	});
});

describe('Q30 hints', () => {
	it('exactly 2 hints', () => { expect(getChallengeBySlot(SLOT)!.hints).toHaveLength(2); });
	it('ordered 1 and 2', () => {
		const m = getChallengeBySlot(SLOT)!;
		expect(m.hints[0].order).toBe(1); expect(m.hints[1].order).toBe(2);
	});
	it('getChallengeHints returns 2', () => { expect(getChallengeHints(SLOT)).toHaveLength(2); });
	it('hint 2 points back to the Q1 codename', () => {
		const h2 = getChallengeBySlot(SLOT)!.hints[1].text;
		expect(h2).toContain('Q1');
		expect(h2).toContain('codename');
	});
	it('hints do not contain any specific codename from pool', () => {
		const hints = getChallengeBySlot(SLOT)!.hints;
		// The codenames are distinct words; hints should not give one away
		CODENAME_POOL.forEach(name => {
			hints.forEach(h => {
				// Skip very common short words that might coincidentally appear
				if (name.length > 6) {
					expect(h.text.toUpperCase()).not.toContain(name);
				}
			});
		});
	});
});

describe('Q30 progression', () => {
	it('locked at Q29', () => { expect(getChallengeAccessStatus({ currentChallenge: 29 }, 30)).toBe('locked'); });
	it('current at Q30', () => { expect(getChallengeAccessStatus({ currentChallenge: 30 }, 30)).toBe('current'); });
});

describe('Q30 capstone properties', () => {
	it('is the highest basePoints challenge (600)', () => {
		const allSlots = Array.from({ length: 30 }, (_, i) => i + 1);
		const points = allSlots.map(s => getChallengeBySlot(s)!.metadata.basePoints);
		expect(Math.max(...points)).toBe(600);
		expect(getChallengeBySlot(30)!.metadata.basePoints).toBe(600);
		points.slice(1).forEach((p, i) => expect(p).toBeGreaterThanOrEqual(points[i]));
	});
	it('is the only challenge with tier "capstone"', () => {
		const allSlots = Array.from({ length: 30 }, (_, i) => i + 1);
		const capstones = allSlots.filter(s => getChallengeBySlot(s)!.metadata.tier === 'capstone');
		expect(capstones).toHaveLength(1);
		expect(capstones[0]).toBe(30);
	});
	it('subject is always a valid CODENAME_POOL entry', async () => {
		for (const r of ROLLS.slice(0, 20)) expect(CODENAME_POOL).toContain((await priv(r)).codename);
	});
});
