/**
 * Shared test factory for challenge tests.
 * Generates registration, determinism, progression, and boundary tests
 * from a single configuration object — eliminating per-challenge boilerplate.
 */
import { describe, expect, it } from 'vitest';
import {
  generateChallengeForParticipant,
  getPublicChallengeData,
  validateChallengeAnswer,
  getChallengeHints,
  type EngineContext,
} from '../../../src/lib/challenges/engine';
import { getChallengeBySlot, getChallengeByKey } from '../../../src/lib/challenges/registry';
import { getChallengeAccessStatus } from '../../../src/lib/challenges/access';

const ENV   = { EVENT_SECRET: 'test-secret-DO-NOT-USE-00000000000' };
const EVENT = { slug: 'case-71c-test', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);

export function ctx(rollNumber: number): EngineContext {
  return { env: ENV, event: EVENT, rollNumber, roster: ROLLS };
}

export interface ChallengeTestConfig {
  /** Slot number (1-30) */
  slot: number;
  /** Expected key (e.g. 'the-seventh-figure') */
  key: string;
  /** Expected title (e.g. 'The Seventh Figure') */
  title: string;
  /** Expected tier */
  tier: 'easy' | 'medium' | 'hard';
  /** Expected base points */
  basePoints: number;
  /** Whether attribution is enabled */
  attributionEnabled: boolean;
  /** Canonical answer for validation testing (normalized lowercase) */
  canonicalAnswer?: string;
  /** Additional describe blocks for challenge-specific tests */
  customTests?: () => void;
}

/**
 * Generate standard challenge tests from config.
 * Covers: registration, determinism, personalization, hints, progression.
 */
export function defineChallengeTests(config: ChallengeTestConfig) {
  const { slot, key, title, tier, basePoints, attributionEnabled, canonicalAnswer, customTests } = config;

  // ── Registration ──────────────────────────────────────────────────────
  describe(`Q${slot} registration`, () => {
    it(`is registered at slot ${slot}`, () => {
      const m = getChallengeBySlot(slot);
      expect(m).toBeDefined();
      expect(m!.metadata.slot).toBe(slot);
    });

    it(`has key "${key}"`, () => {
      const m = getChallengeBySlot(slot)!;
      expect(m.metadata.key).toBe(key);
      expect(getChallengeByKey(key)).toBe(m);
    });

    it(`has title "${title}"`, () => {
      expect(getChallengeBySlot(slot)!.metadata.title).toBe(title);
    });

    it(`has tier ${tier} and basePoints ${basePoints}`, () => {
      const m = getChallengeBySlot(slot)!;
      expect(m.metadata.tier).toBe(tier);
      expect(m.metadata.basePoints).toBe(basePoints);
    });

    it(`attributionEnabled is ${attributionEnabled}`, () => {
      expect(getChallengeBySlot(slot)!.metadata.attributionEnabled).toBe(attributionEnabled);
    });

    it('has exactly two hints in order 1, 2', () => {
      const m = getChallengeBySlot(slot)!;
      expect(m.hints).toHaveLength(2);
      expect(m.hints[0].order).toBe(1);
      expect(m.hints[1].order).toBe(2);
    });
  });

  // ── Determinism ───────────────────────────────────────────────────────
  describe(`Q${slot} determinism`, () => {
    it('produces identical output for the same roll', async () => {
      const a = await generateChallengeForParticipant(ctx(ROLLS[0]), slot);
      const b = await generateChallengeForParticipant(ctx(ROLLS[0]), slot);
      expect(a.instance.publicData).toEqual(b.instance.publicData);
    });

    it('produces different output for different rolls', async () => {
      const a = await generateChallengeForParticipant(ctx(ROLLS[0]), slot);
      const b = await generateChallengeForParticipant(ctx(ROLLS[1]), slot);
      expect(a.instance.publicData).not.toEqual(b.instance.publicData);
    });
  });

  // ── Personalization ───────────────────────────────────────────────────
  describe(`Q${slot} personalization`, () => {
    it('returns public data for 5 different rolls', async () => {
      for (const roll of ROLLS.slice(0, 5)) {
        const pub = await getPublicChallengeData(ctx(roll), slot);
        expect(pub).toBeDefined();
        expect(pub.slot).toBe(slot);
      }
    });
  });

  // ── Public/private boundary ───────────────────────────────────────────
  describe(`Q${slot} public/private boundary`, () => {
    it('public data does not contain privateData', async () => {
      const pub = await getPublicChallengeData(ctx(ROLLS[0]), slot);
      expect((pub as any).privateData).toBeUndefined();
      expect((pub as any).seed).toBeUndefined();
    });
  });

  // ── Hints ─────────────────────────────────────────────────────────────
  describe(`Q${slot} hints`, () => {
    it('has exactly two hints', () => {
      const hints = getChallengeHints(slot);
      expect(hints).toHaveLength(2);
      expect(typeof hints[0].text).toBe('string');
      expect(hints[0].text.length).toBeGreaterThan(0);
      expect(hints[1].text.length).toBeGreaterThan(0);
    });
  });

  // ── Validation (canonical answer) ─────────────────────────────────────
  if (canonicalAnswer) {
    describe(`Q${slot} validation`, () => {
      it('accepts the canonical answer', async () => {
        const result = await validateChallengeAnswer(ctx(ROLLS[2]), slot, canonicalAnswer);
        expect(result.correct).toBe(true);
      });

      it('rejects wrong answers', async () => {
        const result = await validateChallengeAnswer(ctx(ROLLS[2]), slot, 'definitely-wrong');
        expect(result.correct).toBe(false);
      });
    });
  }

  // ── Progression gate ──────────────────────────────────────────────────
  describe(`Q${slot} progression`, () => {
    it('is locked when current_challenge < slot', () => {
      const status = getChallengeAccessStatus({ currentChallenge: slot - 1 }, slot);
      expect(status).toBe('locked');
    });

    it('is current when current_challenge == slot', () => {
      const status = getChallengeAccessStatus({ currentChallenge: slot }, slot);
      expect(status).toBe('current');
    });

    it('is solved when current_challenge > slot', () => {
      const status = getChallengeAccessStatus({ currentChallenge: slot + 1 }, slot);
      expect(status).toBe('solved');
    });
  });

  // ── Custom tests ──────────────────────────────────────────────────────
  if (customTests) {
    describe(`Q${slot} custom`, customTests);
  }
}
