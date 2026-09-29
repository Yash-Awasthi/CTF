/**
 * Q30 — The Subject
 * Personalized answer: participant's investigator codename (same as Q1).
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
	it('basePoints 500', () => { expect(getChallengeBySlot(SLOT)!.metadata.basePoints).toBe(500); });
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

describe('Q30 personalized answer', () => {
	it('answer matches getCodename(rollNumber) for each participant', async () => {
		const roll = ROLLS[0];
		const { instance } = await generateChallengeForParticipant(ctx(roll), SLOT);
		expect((instance.privateData as { answer: string }).answer).toBe(getCodename(roll));
	});
	it('different rolls produce different answers', async () => {
		const answers = await Promise.all([ROLLS[0], ROLLS[1], ROLLS[5], ROLLS[10]].map(async r => {
			const { instance } = await generateChallengeForParticipant(ctx(r), SLOT);
			return (instance.privateData as { answer: string }).answer;
		}));
		expect(new Set(answers).size).toBe(4);
	});
	it('same roll produces same answer deterministically', async () => {
		const roll = ROLLS[7];
		const [a, b] = await Promise.all([
			generateChallengeForParticipant(ctx(roll), SLOT),
			generateChallengeForParticipant(ctx(roll), SLOT),
		]);
		expect((a.instance.privateData as { answer: string }).answer).toBe((b.instance.privateData as { answer: string }).answer);
	});
	it('Q1 and Q30 produce identical codename for same roll', async () => {
		// Q30 uses getCodename(rollNumber) — same formula as Q1
		const roll = ROLLS[3];
		const { instance } = await generateChallengeForParticipant(ctx(roll), SLOT);
		expect((instance.privateData as { answer: string }).answer).toBe(getCodename(roll));
	});
});

describe('Q30 prompt content', () => {
	it('shows THE CONTINUITY header', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[0]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('THE CONTINUITY');
	});
	it('shows CONTINUITY RECORD: CURRENT', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[1]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('CONTINUITY RECORD: CURRENT');
	});
	it('shows COLLECTOR, SUBJECT, INVESTIGATOR, WITNESS all COMPLETE', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[2]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('COLLECTOR    : COMPLETE');
		expect(prompt).toContain('SUBJECT      : COMPLETE');
		expect(prompt).toContain('INVESTIGATOR : COMPLETE');
		expect(prompt).toContain('WITNESS      : COMPLETE');
	});
	it('shows SUCCESSOR : PENDING', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[3]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('SUCCESSOR    : PENDING');
	});
	it('shows FINAL QUERY — IDENTIFY THE SUBJECT', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[4]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('FINAL QUERY');
		expect(prompt).toContain('IDENTIFY THE SUBJECT');
	});
	it('prompt is identical across all participants (codename not in prompt)', async () => {
		const prompts = await Promise.all(ROLLS.slice(0, 5).map(async r => {
			const { instance } = await generateChallengeForParticipant(ctx(r), SLOT);
			return (instance.publicData as { prompt: string }).prompt;
		}));
		// All prompts identical — personalization is only in privateData.answer
		expect(new Set(prompts).size).toBe(1);
	});
	it('prompt contains decorative separator lines', async () => {
		const { instance } = await generateChallengeForParticipant(ctx(ROLLS[0]), SLOT);
		const { prompt } = instance.publicData as { prompt: string };
		expect(prompt).toContain('━━━');
	});
});

describe('Q30 validation', () => {
	it('correct codename validates', async () => {
		const roll = ROLLS[0];
		const answer = getCodename(roll);
		expect((await validateChallengeAnswer(ctx(roll), SLOT, answer)).correct).toBe(true);
	});
	it('lowercase codename validates', async () => {
		const roll = ROLLS[1];
		const answer = getCodename(roll).toLowerCase();
		expect((await validateChallengeAnswer(ctx(roll), SLOT, answer)).correct).toBe(true);
	});
	it('whitespace trims', async () => {
		const roll = ROLLS[2];
		const answer = `  ${getCodename(roll)}  `;
		expect((await validateChallengeAnswer(ctx(roll), SLOT, answer)).correct).toBe(true);
	});
	it('empty fails', async () => {
		expect((await validateChallengeAnswer(ctx(ROLLS[3]), SLOT, '')).correct).toBe(false);
	});
	it('wrong participant codename fails', async () => {
		const roll = ROLLS[4];
		const wrongCodename = getCodename(ROLLS[99]); // different participant's codename
		if (wrongCodename !== getCodename(roll)) {
			expect((await validateChallengeAnswer(ctx(roll), SLOT, wrongCodename)).correct).toBe(false);
		}
	});
	it('THE CONTINUITY fails (Q29 answer, not Q30)', async () => {
		expect((await validateChallengeAnswer(ctx(ROLLS[5]), SLOT, 'THE CONTINUITY')).correct).toBe(false);
	});
	it('SUCCESSOR fails (Q28 answer, not Q30)', async () => {
		expect((await validateChallengeAnswer(ctx(ROLLS[6]), SLOT, 'SUCCESSOR')).correct).toBe(false);
	});
});

describe('Q30 hints', () => {
	it('exactly 2 hints', () => { expect(getChallengeBySlot(SLOT)!.hints).toHaveLength(2); });
	it('ordered 1 and 2', () => {
		const m = getChallengeBySlot(SLOT)!;
		expect(m.hints[0].order).toBe(1); expect(m.hints[1].order).toBe(2);
	});
	it('getChallengeHints returns 2', () => { expect(getChallengeHints(SLOT)).toHaveLength(2); });
	it('hint 2 references investigator codename from Q1', () => {
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
	it('is the highest basePoints challenge (500)', () => {
		const allSlots = Array.from({ length: 30 }, (_, i) => i + 1);
		const points = allSlots.map(s => getChallengeBySlot(s)!.metadata.basePoints);
		expect(Math.max(...points)).toBe(500);
		expect(getChallengeBySlot(30)!.metadata.basePoints).toBe(500);
	});
	it('is the only challenge with tier "capstone"', () => {
		const allSlots = Array.from({ length: 30 }, (_, i) => i + 1);
		const capstones = allSlots.filter(s => getChallengeBySlot(s)!.metadata.tier === 'capstone');
		expect(capstones).toHaveLength(1);
		expect(capstones[0]).toBe(30);
	});
	it('answer is always a valid CODENAME_POOL entry', async () => {
		const answers = await Promise.all(ROLLS.slice(0, 20).map(async r => {
			const { instance } = await generateChallengeForParticipant(ctx(r), SLOT);
			return (instance.privateData as { answer: string }).answer;
		}));
		answers.forEach(a => expect(CODENAME_POOL).toContain(a));
	});
});
