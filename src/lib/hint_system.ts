/**
 * Progressive Hint System
 * Synthesized from hack-the-arch, rootthebox, and classquiz patterns
 * 
 * Features:
 * - Progressive hint unlocking with cost deduction
 * - Timer-based automatic reveals
 * - Team-shared hints
 * - Hint usage analytics
 */

export interface Hint {
  id: string;
  challengeId: string;
  level: number;          // 1 = easiest, higher = more specific
  content: string;
  cost: number;           // Points deducted when used
  autoRevealAt: number;   // Timestamp when hint auto-reveals (0 = never)
  isFree: boolean;        // First hint can be free
  metadata: {
    category: string;     // 'nudge', 'direction', 'solution'
    difficulty: string;   // 'easy', 'medium', 'hard'
  };
}

export interface HintState {
  userId: string;
  challengeId: string;
  revealedHints: number[];
  totalCost: number;
  lastRevealedAt: number;
  teamId?: string;
}

export interface HintConfig {
  maxHintsPerChallenge: number;
  baseCost: number;
  costMultiplier: number;       // Each subsequent hint costs more
  freeHintCount: number;        // Number of free hints
  autoRevealDelay: number;      // Hours before auto-reveal
  teamSharingEnabled: boolean;
  rateLimitPerMinute: number;
}

const DEFAULT_CONFIG: HintConfig = {
  maxHintsPerChallenge: 5,
  baseCost: 50,
  costMultiplier: 1.5,
  freeHintCount: 1,
  autoRevealDelay: 24,         // 24 hours
  teamSharingEnabled: true,
  rateLimitPerMinute: 5
};

/**
 * Calculate hint cost based on level and usage
 */
export function calculateHintCost(
  hint: Hint,
  hintsRevealed: number,
  config: HintConfig = DEFAULT_CONFIG
): number {
  // Free hints
  if (hint.isFree || hintsRevealed < config.freeHintCount) {
    return 0;
  }
  
  // Base cost with multiplier for each subsequent hint
  const cost = config.baseCost * Math.pow(config.costMultiplier, hintsRevealed - config.freeHintCount);
  
  // Level discount (harder hints are worth more)
  const levelDiscount = Math.max(0.5, 1 - (hint.level - 1) * 0.1);
  
  // Cap maximum cost at 500 points to prevent overflow
  const maxCost = 500;
  return Math.min(maxCost, Math.round(cost * levelDiscount));
}

/**
 * Get available hints for a challenge
 */
export function getAvailableHints(
  challengeId: string,
  hints: Hint[],
  state: HintState,
  currentTime: number
): Hint[] {
  return hints
    .filter(h => h.challengeId === challengeId)
    .filter(h => !state.revealedHints.includes(h.level))
    .filter(h => h.autoRevealAt === 0 || currentTime >= h.autoRevealAt)
    .sort((a, b) => a.level - b.level);
}

/**
 * Reveal a hint
 */
export function revealHint(
  hint: Hint,
  state: HintState,
  config: HintConfig = DEFAULT_CONFIG
): { success: boolean; cost: number; newState: HintState; error?: string } {
  // Check if hint already revealed
  if (state.revealedHints.includes(hint.level)) {
    return { success: false, cost: 0, newState: state, error: 'Hint already revealed' };
  }
  
  // Check max hints
  if (state.revealedHints.length >= config.maxHintsPerChallenge) {
    return { success: false, cost: 0, newState: state, error: 'Max hints reached' };
  }
  
  // Calculate cost
  const cost = calculateHintCost(hint, state.revealedHints.length, config);
  
  // Update state
  const newState: HintState = {
    ...state,
    revealedHints: [...state.revealedHints, hint.level],
    totalCost: state.totalCost + cost,
    lastRevealedAt: Date.now()
  };
  
  return { success: true, cost, newState };
}

/**
 * Check if hints should auto-reveal
 */
export function checkAutoReveal(
  hints: Hint[],
  state: HintState,
  currentTime: number
): Hint[] {
  return hints
    .filter(h => h.challengeId === state.challengeId)
    .filter(h => !state.revealedHints.includes(h.level))
    .filter(h => h.autoRevealAt > 0 && currentTime >= h.autoRevealAt);
}

/**
 * Get hint statistics for a challenge
 */
export function getHintStats(
  challengeId: string,
  allStates: HintState[]
): {
  totalRevealed: number;
  averageCost: number;
  mostUsedHint: number;
  revealRate: number;
} {
  const challengeStates = allStates.filter(s => s.challengeId === challengeId);
  
  if (challengeStates.length === 0) {
    return { totalRevealed: 0, averageCost: 0, mostUsedHint: 0, revealRate: 0 };
  }
  
  // Count reveals per hint level
  const levelCounts: Record<number, number> = {};
  let totalRevealed = 0;
  let totalCost = 0;
  
  for (const state of challengeStates) {
    for (const level of state.revealedHints) {
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      totalRevealed++;
      totalCost += state.totalCost;
    }
  }
  
  // Find most used hint
  const mostUsedHint = Object.entries(levelCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 0;
  
  return {
    totalRevealed,
    averageCost: totalRevealed > 0 ? totalCost / challengeStates.length : 0,
    mostUsedHint: Number(mostUsedHint),
    revealRate: challengeStates.length > 0 ? totalRevealed / challengeStates.length : 0
  };
}

/**
 * Share hints with team members
 */
export function shareHintsWithTeam(
  hint: Hint,
  teamMembers: string[],
  sharedBy: string
): Array<{ userId: string; hint: Hint; sharedBy: string; timestamp: number }> {
  return teamMembers
    .filter(id => id !== sharedBy)
    .map(userId => ({
      userId,
      hint,
      sharedBy,
      timestamp: Date.now()
    }));
}

/**
 * Create hint configuration from challenge data
 */
export function createHintConfig(challengeData: {
  difficulty: string;
  category: string;
  pointValue: number;
}): HintConfig {
  const baseConfig = { ...DEFAULT_CONFIG };
  
  // Adjust based on difficulty
  switch (challengeData.difficulty) {
    case 'easy':
      baseConfig.baseCost = 25;
      baseConfig.freeHintCount = 2;
      baseConfig.autoRevealDelay = 12;
      break;
    case 'medium':
      baseConfig.baseCost = 50;
      baseConfig.freeHintCount = 1;
      baseConfig.autoRevealDelay = 24;
      break;
    case 'hard':
      baseConfig.baseCost = 100;
      baseConfig.freeHintCount = 0;
      baseConfig.autoRevealDelay = 48;
      break;
    case 'extreme':
      baseConfig.baseCost = 200;
      baseConfig.freeHintCount = 0;
      baseConfig.autoRevealDelay = 72;
      break;
  }
  
  // Adjust based on point value
  if (challengeData.pointValue > 500) {
    baseConfig.costMultiplier = 2.0;
  }
  
  return baseConfig;
}