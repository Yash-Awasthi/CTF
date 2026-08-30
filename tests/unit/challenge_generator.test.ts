/**
 * Tests for challenge_generator.ts
 */
import { describe, it, expect } from 'vitest';
import { ChallengeGenerator, TEMPLATES, DIFFICULTY_POINTS } from '../../src/lib/challenge_generator';

describe('ChallengeGenerator', () => {
  const gen = new ChallengeGenerator();

  describe('generateFlag', () => {
    it('creates flag with default prefix/suffix', () => {
      const flag = gen.generateFlag();
      expect(flag).toMatch(/^flag\{[a-f0-9]+\}$/);
    });

    it('creates unique flags', () => {
      const flags = new Set(Array.from({ length: 10 }, () => gen.generateFlag()));
      expect(flags.size).toBe(10);
    });
  });

  describe('generate', () => {
    it('creates a challenge from template', () => {
      const challenge = gen.generate('crypto', 'easy');
      expect(challenge.category).toBe('crypto');
      expect(challenge.difficulty).toBe('easy');
      expect(challenge.flag).toMatch(/^flag\{.*\}$/);
      expect(challenge.basePoints).toBe(100);
      expect(challenge.hints.length).toBeGreaterThan(0);
    });

    it('throws for unknown category', () => {
      expect(() => gen.generate('nonexistent')).toThrow('No templates');
    });

    it('generates all categories', () => {
      for (const category of Object.keys(TEMPLATES)) {
        const challenge = gen.generate(category);
        expect(challenge.category).toBe(category);
      }
    });
  });

  describe('generateSet', () => {
    it('creates requested number of challenges', () => {
      const set = gen.generateSet(30);
      expect(set.length).toBe(30);
    });

    it('spreads across categories', () => {
      const set = gen.generateSet(28);
      const categories = new Set(set.map(c => c.category));
      expect(categories.size).toBe(Object.keys(TEMPLATES).length);
    });

    it('balances difficulties', () => {
      const set = gen.generateSet(30);
      const difficulties = set.map(c => c.difficulty);
      expect(difficulties).toContain('easy');
      expect(difficulties).toContain('medium');
      expect(difficulties).toContain('hard');
    });
  });

  describe('calculateDynamicPoints', () => {
    it('decays with solves', () => {
      const challenge = gen.generate('crypto', 'easy');
      const initial = gen.calculateDynamicPoints(challenge);
      
      challenge.solveCount = 10;
      const after = gen.calculateDynamicPoints(challenge);
      
      expect(after).toBeLessThan(initial);
    });

    it('has minimum floor', () => {
      const challenge = gen.generate('crypto', 'easy');
      challenge.solveCount = 1000;
      const points = gen.calculateDynamicPoints(challenge);
      expect(points).toBeGreaterThanOrEqual(10); // 10% of 100
    });
  });

  describe('submitFlag', () => {
    it('accepts correct flag (case-insensitive)', () => {
      const challenge = gen.generate('crypto');
      const result = gen.submitFlag(challenge, challenge.flag.toUpperCase());
      expect(result.correct).toBe(true);
      expect(result.points).toBeGreaterThan(0);
    });

    it('rejects wrong flag', () => {
      const challenge = gen.generate('crypto');
      const result = gen.submitFlag(challenge, 'flag{wrong}');
      expect(result.correct).toBe(false);
      expect(result.points).toBe(0);
    });

    it('increments solve count on correct', () => {
      const challenge = gen.generate('crypto');
      const initial = challenge.solveCount;
      gen.submitFlag(challenge, challenge.flag);
      expect(challenge.solveCount).toBe(initial + 1);
    });
  });

  describe('revealHint', () => {
    it('reveals hint and deducts points', () => {
      const challenge = gen.generate('crypto', 'easy');
      const result = gen.revealHint(challenge, 0, 100);
      expect(result.hint).toBeTruthy();
      expect(result.cost).toBeGreaterThan(0);
      expect(result.newPoints).toBeLessThan(100);
    });

    it('does not double-deduct', () => {
      const challenge = gen.generate('crypto', 'easy');
      gen.revealHint(challenge, 0, 100);
      const result = gen.revealHint(challenge, 0, 90);
      expect(result.cost).toBe(0);
      expect(result.newPoints).toBe(90);
    });

    it('handles invalid index', () => {
      const challenge = gen.generate('crypto');
      const result = gen.revealHint(challenge, 99, 100);
      expect(result.hint).toBeNull();
    });
  });
});

describe('DIFFICULTY_POINTS', () => {
  it('has all difficulties', () => {
    expect(DIFFICULTY_POINTS).toHaveProperty('easy');
    expect(DIFFICULTY_POINTS).toHaveProperty('medium');
    expect(DIFFICULTY_POINTS).toHaveProperty('hard');
    expect(DIFFICULTY_POINTS).toHaveProperty('extreme');
  });

  it('points increase with difficulty', () => {
    expect(DIFFICULTY_POINTS.easy.base).toBeLessThan(DIFFICULTY_POINTS.medium.base);
    expect(DIFFICULTY_POINTS.medium.base).toBeLessThan(DIFFICULTY_POINTS.hard.base);
    expect(DIFFICULTY_POINTS.hard.base).toBeLessThan(DIFFICULTY_POINTS.extreme.base);
  });
});
