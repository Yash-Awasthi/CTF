/**
 * CTF Hint System — Progressive hints with cost deduction and team sharing
 * Inspired by hack-the-arch, rootthebox
 */

export interface Hint {
  id: string;
  challengeId: string;
  content: string;
  cost: number;
  order: number;
  category: 'nudge' | 'partial' | 'detailed' | 'solution_adjacent';
  unlockTime?: number;
  revealed: boolean;
}

export interface HintPurchase {
  hintId: string;
  userId: string;
  timestamp: number;
  cost: number;
  teamId?: string;
}

export interface HintConfig {
  baseCost: number;
  costIncrement: number;
  maxCost: number;
  revealTimeMinutes: number;
  teamShared: boolean;
  categoryMultipliers: Record<string, number>;
}

const DEFAULT_HINT_CONFIG: HintConfig = {
  baseCost: 25,
  costIncrement: 10,
  maxCost: 150,
  revealTimeMinutes: 30,
  teamShared: true,
  categoryMultipliers: {
    nudge: 0.5,
    partial: 1.0,
    detailed: 1.5,
    solution_adjacent: 2.0,
  },
};

export function calculateHintCost(
  hintOrder: number,
  hintsUsed: number,
  config: HintConfig = DEFAULT_HINT_CONFIG
): number {
  const baseCost = config.baseCost + (hintOrder - 1) * config.costIncrement;
  const categoryMultiplier = 1.0;
  const usagePenalty = hintsUsed * 5;
  return Math.min(config.maxCost, Math.round((baseCost + usagePenalty) * categoryMultiplier));
}

export function shouldAutoReveal(
  challengeCreated: number,
  config: HintConfig = DEFAULT_HINT_CONFIG
): boolean {
  const elapsedMinutes = (Date.now() - challengeCreated) / (1000 * 60);
  return elapsedMinutes >= config.revealTimeMinutes;
}

export function getAvailableHints(
  hints: Hint[],
  userId: string,
  teamId?: string,
  purchasedHintIds: string[] = []
): Hint[] {
  return hints
    .filter((hint) => {
      if (hint.revealed) return true;
      if (purchasedHintIds.includes(hint.id)) return true;
      return false;
    })
    .sort((a, b) => a.order - b.order);
}

export function purchaseHint(
  hint: Hint,
  userPoints: number,
  hintsUsed: number,
  config: HintConfig = DEFAULT_HINT_CONFIG
): { success: boolean; cost: number; newPoints: number; error?: string } {
  const cost = calculateHintCost(hint.order, hintsUsed, config);
  if (userPoints < cost) {
    return { success: false, cost, newPoints: userPoints, error: 'Insufficient points' };
  }
  return { success: true, cost, newPoints: userPoints - cost };
}

export function generateHintPreview(hint: Hint, maxLength: number = 50): string {
  if (hint.content.length <= maxLength) return hint.content;
  return hint.content.substring(0, maxLength) + '...';
}

export function calculateHintValue(
  hint: Hint,
  solveRate: number,
  hintsUsed: number
): number {
  const categoryValue: Record<string, number> = {
    nudge: 0.3,
    partial: 0.5,
    detailed: 0.7,
    solution_adjacent: 0.9,
  };
  const baseValue = categoryValue[hint.category] || 0.5;
  const usageFactor = Math.min(1.0, hintsUsed / 10);
  const solveRateFactor = solveRate > 0.5 ? 0.8 : 1.2;
  return Math.round(baseValue * (1 + usageFactor) * solveRateFactor * 100);
}

export function getHintLeaderboard(
  purchases: HintPurchase[],
  hints: Hint[]
): { userId: string; totalSpent: number; hintsPurchased: number }[] {
  const userStats: Record<string, { totalSpent: number; hintsPurchased: number }> = {};
  for (const purchase of purchases) {
    if (!userStats[purchase.userId]) {
      userStats[purchase.userId] = { totalSpent: 0, hintsPurchased: 0 };
    }
    userStats[purchase.userId].totalSpent += purchase.cost;
    userStats[purchase.userId].hintsPurchased += 1;
  }
  return Object.entries(userStats)
    .map(([userId, stats]) => ({ userId, ...stats }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}
