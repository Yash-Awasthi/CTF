/**
 * Tests for hint_marketplace.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HintMarketplace, HintCategory } from '../../src/lib/hint_marketplace';

describe('HintMarketplace', () => {
  let marketplace: HintMarketplace;

  beforeEach(() => {
    marketplace = new HintMarketplace();
  });

  describe('submitHint', () => {
    it('creates a hint with preview from first line', () => {
      const hint = marketplace.submitHint('q07', 'alice', 'nudge', 'First line preview\nFull content here');
      expect(hint.preview).toBe('First line preview');
      expect(hint.content).toBe('First line preview\nFull content here');
      expect(hint.challengeId).toBe('q07');
      expect(hint.authorId).toBe('alice');
    });

    it('assigns category-based cost', () => {
      const nudge = marketplace.submitHint('q07', 'a', 'nudge', 'hint');
      const detailed = marketplace.submitHint('q07', 'b', 'detailed', 'hint');
      expect(detailed.cost).toBeGreaterThan(nudge.cost);
    });

    it('auto-features hints from established authors', () => {
      // Build up reputation
      for (let i = 0; i < 10; i++) {
        marketplace.submitHint(`q${i}`, 'trusted_author', 'nudge', `hint ${i}`);
      }
      // Vote up their hints
      const hints = marketplace.browse({ sortBy: 'newest' });
      for (const h of hints) {
        for (let j = 0; j < 5; j++) marketplace.rateHint(h.id, `voter${j}`, true);
      }
      const stats = marketplace.getAuthorStats('trusted_author');
      expect(stats.reputation).toBeGreaterThan(0);
    });

    it('generates unique IDs', () => {
      const h1 = marketplace.submitHint('q07', 'a', 'nudge', 'hint1');
      const h2 = marketplace.submitHint('q07', 'b', 'nudge', 'hint2');
      expect(h1.id).not.toBe(h2.id);
    });
  });

  describe('rateHint', () => {
    it('increases upvotes', () => {
      const hint = marketplace.submitHint('q07', 'a', 'nudge', 'test hint');
      marketplace.rateHint(hint.id, 'voter1', true);
      expect(hint.upvotes).toBe(1);
      expect(hint.rating).toBe(1);
    });

    it('increases downvotes', () => {
      const hint = marketplace.submitHint('q07', 'a', 'nudge', 'test hint');
      marketplace.rateHint(hint.id, 'voter1', false);
      expect(hint.downvotes).toBe(1);
      expect(hint.rating).toBe(0);
    });

    it('returns null for invalid hint', () => {
      expect(marketplace.rateHint('nonexistent', 'voter', true)).toBeNull();
    });

    it('features high-quality hints', () => {
      const hint = marketplace.submitHint('q07', 'a', 'nudge', 'great hint');
      for (let i = 0; i < 5; i++) marketplace.rateHint(hint.id, `v${i}`, true);
      expect(hint.isFeatured).toBe(true);
    });
  });

  describe('purchaseHint', () => {
    it('allows purchase with sufficient points', () => {
      const hint = marketplace.submitHint('q07', 'alice', 'nudge', 'hint');
      const result = marketplace.purchaseHint(hint.id, 'buyer', 100);
      expect(result.success).toBe(true);
    });

    it('rejects insufficient points', () => {
      const hint = marketplace.submitHint('q07', 'alice', 'detailed', 'hint');
      const result = marketplace.purchaseHint(hint.id, 'buyer', 1);
      expect(result.success).toBe(false);
    });

    it('allows author to view free', () => {
      const hint = marketplace.submitHint('q07', 'alice', 'nudge', 'hint');
      const result = marketplace.purchaseHint(hint.id, 'alice', 0);
      expect(result.success).toBe(true);
    });

    it('detects duplicate purchase', () => {
      const hint = marketplace.submitHint('q07', 'alice', 'nudge', 'hint');
      marketplace.purchaseHint(hint.id, 'buyer', 100);
      const result = marketplace.purchaseHint(hint.id, 'buyer', 100);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Already purchased');
    });

    it('rejects non-existent hint', () => {
      const result = marketplace.purchaseHint('nope', 'buyer', 100);
      expect(result.success).toBe(false);
    });
  });

  describe('browse', () => {
    it('filters by challenge', () => {
      marketplace.submitHint('q07', 'a', 'nudge', 'hint for q07');
      marketplace.submitHint('q08', 'b', 'nudge', 'hint for q08');
      const results = marketplace.browse({ challengeId: 'q07' });
      expect(results.every(h => h.challengeId === 'q07')).toBe(true);
    });

    it('filters by category', () => {
      marketplace.submitHint('q07', 'a', 'nudge', 'nudge hint');
      marketplace.submitHint('q07', 'b', 'detailed', 'detailed hint');
      const results = marketplace.browse({ category: 'nudge' });
      expect(results.every(h => h.category === 'nudge')).toBe(true);
    });

    it('sorts by rating', () => {
      const h1 = marketplace.submitHint('q07', 'a', 'nudge', 'ok hint');
      const h2 = marketplace.submitHint('q07', 'b', 'nudge', 'great hint');
      marketplace.rateHint(h1.id, 'v1', true);
      marketplace.rateHint(h1.id, 'v2', false); // 50% rating
      marketplace.rateHint(h2.id, 'v1', true);
      marketplace.rateHint(h2.id, 'v2', true);  // 100% rating
      const results = marketplace.browse({ sortBy: 'rating' });
      expect(results[0].id).toBe(h2.id);
    });
  });

  describe('getLeaderboard', () => {
    it('returns authors sorted by reputation', () => {
      marketplace.submitHint('q07', 'alice', 'nudge', 'hint');
      marketplace.submitHint('q07', 'bob', 'nudge', 'hint');
      const lb = marketplace.getLeaderboard();
      expect(lb.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('tracks marketplace stats', () => {
      marketplace.submitHint('q07', 'a', 'nudge', 'hint1');
      marketplace.submitHint('q07', 'b', 'nudge', 'hint2');
      const stats = marketplace.getStats();
      expect(stats.totalHints).toBe(2);
      expect(stats.totalAuthors).toBe(2);
    });
  });
});
