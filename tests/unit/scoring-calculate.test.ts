import { describe, expect, it } from 'vitest';
import {
	calculateSolveScore,
	calculateSolveScoreForEvent,
	deriveElapsedSeconds,
	timeFactorPerMille,
} from '../../src/lib/scoring/calculate';
import type { EventRow } from '../../src/lib/auth/types';

const D = 3600; // 1h duration
const BASE = 100; // 100 points → 100000 milli at full factor

describe('time factor', () => {
	it('is 1.0 (1000) at elapsed 0', () => {
		expect(timeFactorPerMille(0, D)).toBe(1000);
	});
	it('decays linearly (0.75 at half duration)', () => {
		expect(timeFactorPerMille(D / 2, D)).toBe(750);
	});
	it('floors at 0.5 (500) at and beyond duration', () => {
		expect(timeFactorPerMille(D, D)).toBe(500);
		expect(timeFactorPerMille(D * 2, D)).toBe(500);
	});
	it('rejects non-positive duration', () => {
		expect(() => timeFactorPerMille(0, 0)).toThrow();
	});
});

describe('calculateSolveScore — locked formula', () => {
	it('t=0, no hint → full base score in milli-points', () => {
		const s = calculateSolveScore({ basePoints: BASE, elapsedSeconds: 0, durationSeconds: D, hintUsed: false });
		expect(s).toEqual({ timeFactor: 1000, hintFactor: 1000, finalScore: 100_000 });
	});

	it('score decays linearly with elapsed time', () => {
		const s = calculateSolveScore({ basePoints: BASE, elapsedSeconds: D / 2, durationSeconds: D, hintUsed: false });
		expect(s.finalScore).toBe(75_000); // 100 × 0.75 × 1000
	});

	it('time floor: never below 0.5×base from time alone', () => {
		const end = calculateSolveScore({ basePoints: BASE, elapsedSeconds: D, durationSeconds: D, hintUsed: false });
		expect(end.finalScore).toBe(50_000);
		const past = calculateSolveScore({ basePoints: BASE, elapsedSeconds: D * 5, durationSeconds: D, hintUsed: false });
		expect(past.finalScore).toBe(50_000); // clamped
	});

	it('hint halves the score once (t=0)', () => {
		const s = calculateSolveScore({ basePoints: BASE, elapsedSeconds: 0, durationSeconds: D, hintUsed: true });
		expect(s).toEqual({ timeFactor: 1000, hintFactor: 500, finalScore: 50_000 });
	});

	it('hint factor is binary — one flag, not per-hint stacking', () => {
		// The API takes a single boolean; "both hints used" is still just true.
		const oneOrBoth = calculateSolveScore({ basePoints: BASE, elapsedSeconds: 0, durationSeconds: D, hintUsed: true });
		expect(oneOrBoth.hintFactor).toBe(500);
		expect(oneOrBoth.finalScore).toBe(50_000); // not 25000
	});

	it('absolute floor 0.25×base with time floor × hint', () => {
		const s = calculateSolveScore({ basePoints: BASE, elapsedSeconds: D, durationSeconds: D, hintUsed: true });
		expect(s.finalScore).toBe(25_000);
	});

	it('final score is always an integer (milli-points)', () => {
		for (const base of [100, 200, 300, 500]) {
			for (const e of [0, 1, 137, 1800, 3599, 3600]) {
				for (const h of [false, true]) {
					const s = calculateSolveScore({ basePoints: base, elapsedSeconds: e, durationSeconds: D, hintUsed: h });
					expect(Number.isInteger(s.finalScore)).toBe(true);
					expect(Number.isInteger(s.timeFactor)).toBe(true);
					expect(Number.isInteger(s.hintFactor)).toBe(true);
					expect(s.timeFactor).toBeGreaterThanOrEqual(500);
					expect(s.timeFactor).toBeLessThanOrEqual(1000);
				}
			}
		}
	});

	it('rejects invalid base points', () => {
		expect(() => calculateSolveScore({ basePoints: 0, elapsedSeconds: 0, durationSeconds: D, hintUsed: false })).toThrow();
	});
});

describe('authoritative timing derivation', () => {
	const startedAt = new Date('2026-07-08T10:00:00Z');
	const event = {
		id: 1,
		startedAt,
		durationSeconds: D,
	} as unknown as EventRow;

	it('derives elapsed seconds from server start + solve time', () => {
		const solvedAt = new Date(startedAt.getTime() + 900_000); // +15 min
		expect(deriveElapsedSeconds(event, solvedAt)).toBe(900);
	});

	it('clamps negative elapsed to 0', () => {
		const before = new Date(startedAt.getTime() - 5000);
		expect(deriveElapsedSeconds(event, before)).toBe(0);
	});

	it('throws if the event has not started', () => {
		const notStarted = { ...event, startedAt: null } as unknown as EventRow;
		expect(() => deriveElapsedSeconds(notStarted, startedAt)).toThrow();
	});

	it('calculateSolveScoreForEvent matches manual elapsed', () => {
		const solvedAt = new Date(startedAt.getTime() + 1_800_000); // +30 min = half
		const s = calculateSolveScoreForEvent(BASE, event, solvedAt, false);
		expect(s.finalScore).toBe(75_000);
	});
});
