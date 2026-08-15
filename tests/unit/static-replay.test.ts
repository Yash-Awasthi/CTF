import { describe, expect, it } from 'vitest';
import {
	replayPersonalize,
	newInvestigatorId,
	buildReplayManifest,
	replayVerify,
	toStaticLeaderboard,
	assertClean,
	PrivacyScrubError,
	type FinalEntry,
} from '../../src/lib/static-replay';

describe('static personalization (public salt, no live crypto)', () => {
	it('is deterministic per (investigatorId, slot)', async () => {
		const a = await replayPersonalize('abc', 3);
		const b = await replayPersonalize('abc', 3);
		expect(a).toEqual(b);
	});
	it('differs by investigator and by slot', async () => {
		const a = await replayPersonalize('abc', 3);
		expect(await replayPersonalize('xyz', 3)).not.toEqual(a);
		expect(await replayPersonalize('abc', 4)).not.toEqual(a);
	});
	it('new investigator ids are random (256-bit hex-ish)', () => {
		expect(newInvestigatorId()).not.toBe(newInvestigatorId());
		expect(newInvestigatorId()).toMatch(/^[0-9a-f]{32}$/);
	});
	it('client-side verify accepts the derived answer, case/space-insensitive', async () => {
		const p = await replayPersonalize('abc', 1);
		expect(replayVerify(`  ${p.expectedAnswer.toUpperCase()} `, p.expectedAnswer)).toBe(true);
		expect(replayVerify('wrong', p.expectedAnswer)).toBe(false);
	});
});

describe('sanitized manifest', () => {
	it('exposes 30 slots of public metadata only (no answers/seeds)', () => {
		const m = buildReplayManifest();
		expect(m).toHaveLength(30);
		expect(m[0].slot).toBe(1);
		for (const c of m) {
			expect(c.hints).toHaveLength(2);
			const keys = Object.keys(c).sort();
			expect(keys).toEqual(['basePoints', 'hints', 'key', 'prompt', 'slot', 'tier', 'title'].sort());
			expect(JSON.stringify(c)).not.toContain('answer');
		}
	});
});

describe('static leaderboard export', () => {
	const entries: FinalEntry[] = [
		{ rollNumber: 25_115_002, score: 90_000, solveCount: 1, lastSolveAt: 30, eliminated: false },
		{ rollNumber: 25_115_000, score: 100_000, solveCount: 2, lastSolveAt: 50, eliminated: false },
		{ rollNumber: 25_115_001, score: 90_000, solveCount: 1, lastSolveAt: 10, eliminated: false },
		{ rollNumber: 25_115_003, score: 200_000, solveCount: 3, lastSolveAt: 5, eliminated: true },
	];
	it('excludes eliminated, orders deterministically, unmasks rolls, shows points', () => {
		const lb = toStaticLeaderboard(entries);
		expect(lb.map((s) => s.rollNumber)).toEqual([25_115_000, 25_115_001, 25_115_002]);
		expect(lb.some((s) => s.rollNumber === 25_115_003)).toBe(false); // eliminated excluded
		expect(lb[0]).toMatchObject({ rank: 1, rollNumber: 25_115_000, score: 100, scoreMilli: 100_000 });
		// tie (90000) broken by earliest final solve → roll ...001 (t=10) before ...002 (t=30)
		expect(lb[1].rollNumber).toBe(25_115_001);
	});
	it('is reproducible for unchanged input', () => {
		expect(toStaticLeaderboard(entries)).toEqual(toStaticLeaderboard(entries));
	});
});

describe('privacy scrub', () => {
	it('passes clean archival content', () => {
		expect(() => assertClean('{"rollNumber":25115000,"score":100}', ['s3cr3t'])).not.toThrow();
	});
	it('rejects forbidden patterns', () => {
		expect(() => assertClean('leak: token_hash=abc')).toThrow(PrivacyScrubError);
		expect(() => assertClean('EVENT_SECRET here')).toThrow(PrivacyScrubError);
		expect(() => assertClean('ownershipMap {}')).toThrow(PrivacyScrubError);
	});
	it('rejects literal secret values', () => {
		expect(() => assertClean('embedded s3cr3t-value', ['s3cr3t-value'])).toThrow(PrivacyScrubError);
	});
	it('does NOT treat unmasked roll numbers as a violation', () => {
		expect(() => assertClean('[{"rank":1,"rollNumber":25115000,"score":100}]')).not.toThrow();
	});
});
