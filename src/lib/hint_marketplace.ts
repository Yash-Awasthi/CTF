/**
 * CTF Hint Marketplace — Community-submitted hints with ratings and pricing.
 *
 * Allows users to submit, rate, and purchase hints for challenges.
 * Includes author reputation tracking and featured hints.
 */

import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HintCategory = 'nudge' | 'partial' | 'detailed' | 'solution_adjacent';

export interface Hint {
  id: string;
  challengeId: string;
  authorId: string;
  category: HintCategory;
  preview: string;       // First line, always visible
  content: string;       // Full hint, paid
  cost: number;          // Points to reveal
  upvotes: number;
  downvotes: number;
  rating: number;        // Computed: upvotes / (upvotes + downvotes)
  createdAt: string;
  isFeatured: boolean;
}

export interface HintPurchase {
  hintId: string;
  buyerId: string;
  cost: number;
  purchasedAt: string;
}

export interface AuthorStats {
  authorId: string;
  hintsSubmitted: number;
  totalUpvotes: number;
  totalDownvotes: number;
  reputation: number;  // 0-100
  averageRating: number;
}

export interface MarketplaceFilters {
  challengeId?: string;
  category?: HintCategory;
  minRating?: number;
  sortBy?: 'rating' | 'newest' | 'cost_low' | 'cost_high' | 'popular';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_BASE_COST: Record<HintCategory, number> = {
  nudge: 5,
  partial: 15,
  detailed: 30,
  solution_adjacent: 50,
};

const REPUTATION_THRESHOLDS = {
  trusted: 80,     // Can set custom pricing
  established: 50, // Hints auto-featured
  new: 0,
};

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export class HintMarketplace {
  private hints: Map<string, Hint> = new Map();
  private purchases: HintPurchase[] = [];
  private authorStats: Map<string, AuthorStats> = new Map();

  /**
   * Submit a new hint.
   */
  submitHint(
    challengeId: string,
    authorId: string,
    category: HintCategory,
    content: string,
    customCost?: number,
  ): Hint {
    const lines = content.split('\n');
    const preview = lines[0].trim();

    // Pricing
    const baseCost = CATEGORY_BASE_COST[category];
    const stats = this.authorStats.get(authorId);
    const reputation = stats?.reputation ?? 0;

    let cost: number;
    if (customCost !== undefined && reputation >= REPUTATION_THRESHOLDS.trusted) {
      cost = Math.max(1, Math.min(100, customCost));
    } else {
      // Dynamic pricing: base ± reputation adjustment
      cost = Math.round(baseCost * (1 - reputation / 200));
      cost = Math.max(1, Math.min(100, cost));
    }

    const hint: Hint = {
      id: `hint_${randomBytes(8).toString('hex')}`,
      challengeId,
      authorId,
      category,
      preview,
      content,
      cost,
      upvotes: 0,
      downvotes: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
      isFeatured: reputation >= REPUTATION_THRESHOLDS.established,
    };

    this.hints.set(hint.id, hint);

    // Update author stats
    this.updateAuthorStats(authorId, 'submit');

    return hint;
  }

  /**
   * Rate a hint (upvote or downvote).
   */
  rateHint(hintId: string, userId: string, isUpvote: boolean): Hint | null {
    const hint = this.hints.get(hintId);
    if (!hint) return null;

    if (isUpvote) {
      hint.upvotes++;
    } else {
      hint.downvotes++;
    }

    // Recalculate rating
    const total = hint.upvotes + hint.downvotes;
    hint.rating = total > 0 ? hint.upvotes / total : 0;

    // Feature high-quality hints
    if (hint.rating >= 0.8 && total >= 5) {
      hint.isFeatured = true;
    }

    // Update author stats
    this.updateAuthorStats(hint.authorId, isUpvote ? 'upvote' : 'downvote');

    return hint;
  }

  /**
   * Purchase and reveal a hint.
   */
  purchaseHint(
    hintId: string,
    buyerId: string,
    buyerPoints: number,
  ): { hint: Hint; success: boolean; message: string } {
    const hint = this.hints.get(hintId);
    if (!hint) {
      return { hint: null as any, success: false, message: 'Hint not found' };
    }

    if (buyerId === hint.authorId) {
      return { hint, success: true, message: 'Author can view their own hint for free' };
    }

    // Check if already purchased
    const alreadyPurchased = this.purchases.some(
      p => p.hintId === hintId && p.buyerId === buyerId,
    );
    if (alreadyPurchased) {
      return { hint, success: true, message: 'Already purchased' };
    }

    if (buyerPoints < hint.cost) {
      return { hint, success: false, message: `Need ${hint.cost} points, have ${buyerPoints}` };
    }

    this.purchases.push({
      hintId,
      buyerId,
      cost: hint.cost,
      purchasedAt: new Date().toISOString(),
    });

    return { hint, success: true, message: `Spent ${hint.cost} points` };
  }

  /**
   * Check if a user has purchased a hint.
   */
  hasPurchased(hintId: string, userId: string): boolean {
    return this.purchases.some(p => p.hintId === hintId && p.buyerId === userId);
  }

  /**
   * Browse hints with filters.
   */
  browse(filters: MarketplaceFilters = {}): Hint[] {
    let results = Array.from(this.hints.values());

    if (filters.challengeId) {
      results = results.filter(h => h.challengeId === filters.challengeId);
    }
    if (filters.category) {
      results = results.filter(h => h.category === filters.category);
    }
    if (filters.minRating !== undefined) {
      results = results.filter(h => h.rating >= filters.minRating!);
    }

    // Sort
    switch (filters.sortBy) {
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'cost_low':
        results.sort((a, b) => a.cost - b.cost);
        break;
      case 'cost_high':
        results.sort((a, b) => b.cost - a.cost);
        break;
      case 'popular':
        results.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
        break;
      default:
        // Featured first, then by rating
        results.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || b.rating - a.rating);
    }

    return results;
  }

  /**
   * Get featured hints for a challenge.
   */
  getFeatured(challengeId: string): Hint[] {
    return this.browse({ challengeId, sortBy: 'rating' })
      .filter(h => h.isFeatured)
      .slice(0, 3);
  }

  /**
   * Get author reputation stats.
   */
  getAuthorStats(authorId: string): AuthorStats {
    return this.authorStats.get(authorId) || {
      authorId,
      hintsSubmitted: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      reputation: 0,
      averageRating: 0,
    };
  }

  /**
   * Get leaderboard of hint contributors.
   */
  getLeaderboard(): AuthorStats[] {
    return Array.from(this.authorStats.values())
      .sort((a, b) => b.reputation - a.reputation || b.totalUpvotes - a.totalUpvotes)
      .slice(0, 20);
  }

  /**
   * Get marketplace summary stats.
   */
  getStats(): { totalHints: number; totalPurchases: number; totalAuthors: number; avgRating: number } {
    const hints = Array.from(this.hints.values());
    const avgRating = hints.length > 0
      ? hints.reduce((s, h) => s + h.rating, 0) / hints.length
      : 0;

    return {
      totalHints: hints.length,
      totalPurchases: this.purchases.length,
      totalAuthors: this.authorStats.size,
      avgRating: Math.round(avgRating * 100) / 100,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private updateAuthorStats(authorId: string, action: 'submit' | 'upvote' | 'downvote'): void {
    if (!this.authorStats.has(authorId)) {
      this.authorStats.set(authorId, {
        authorId,
        hintsSubmitted: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        reputation: 10, // Start at 10
        averageRating: 0,
      });
    }

    const stats = this.authorStats.get(authorId)!;

    if (action === 'submit') {
      stats.hintsSubmitted++;
    } else if (action === 'upvote') {
      stats.totalUpvotes++;
    } else {
      stats.totalDownvotes++;
    }

    // Recalculate reputation (0-100)
    const totalRatings = stats.totalUpvotes + stats.totalDownvotes;
    const ratingScore = totalRatings > 0 ? (stats.totalUpvotes / totalRatings) * 60 : 0;
    const volumeScore = Math.min(40, stats.hintsSubmitted * 5);
    stats.reputation = Math.min(100, Math.round(ratingScore + volumeScore));
    stats.averageRating = totalRatings > 0 ? stats.totalUpvotes / totalRatings : 0;
  }
}
