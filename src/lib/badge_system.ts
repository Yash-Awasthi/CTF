/**
 * Badge System - Achievement and recognition framework.
 * Extracted from flagforge (inspiration).
 * Badge creation, assignment, progression, and display.
 */

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface BadgeTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: BadgeRarity;
  category: "solve" | "streak" | "speed" | "collaboration" | "special";
  criteria: BadgeCriteria;
  isActive: boolean;
  createdAt: Date;
}

export interface BadgeCriteria {
  type: "challenges_solved" | "category_solved" | "first_blood" | "streak_days" | "speed_demon" | "hintless" | "team_score";
  target: number;
  category?: string;
  timeframe?: "daily" | "weekly" | "monthly" | "all_time";
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: Date;
  progress: number;
  maxProgress: number;
}

export interface BadgeProgress {
  templateId: string;
  current: number;
  target: number;
  percentage: number;
}

const RARITY_COLORS: Record<BadgeRarity, string> = {
  common: "#9e9e9e",
  uncommon: "#4caf50",
  rare: "#2196f3",
  epic: "#9c27b0",
  legendary: "#ff9800",
};

const RARITY_XP: Record<BadgeRarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
};

const DEFAULT_BADGES: BadgeTemplate[] = [
  {
    id: "first_blood", name: "First Blood", description: "Solve a challenge first",
    icon: "🩸", color: "#f44336", rarity: "epic", category: "solve",
    criteria: { type: "first_blood", target: 1 }, isActive: true, createdAt: new Date(),
  },
  {
    id: "speed_demon", name: "Speed Demon", description: "Solve 5 challenges in under 10 minutes each",
    icon: "⚡", color: "#ffeb3b", rarity: "rare", category: "speed",
    criteria: { type: "speed_demon", target: 5 }, isActive: true, createdAt: new Date(),
  },
  {
    id: "streak_7", name: "Week Warrior", description: "Solve challenges 7 days in a row",
    icon: "🔥", color: "#ff5722", rarity: "epic", category: "streak",
    criteria: { type: "streak_days", target: 7 }, isActive: true, createdAt: new Date(),
  },
  {
    id: "hintless_hero", name: "Hintless Hero", description: "Solve 10 challenges without using hints",
    icon: "🧠", color: "#673ab7", rarity: "rare", category: "special",
    criteria: { type: "hintless", target: 10 }, isActive: true, createdAt: new Date(),
  },
  {
    id: "crypto_master", name: "Crypto Master", description: "Solve all crypto challenges",
    icon: "🔐", color: "#00bcd4", rarity: "legendary", category: "solve",
    criteria: { type: "category_solved", target: 100, category: "crypto" }, isActive: true, createdAt: new Date(),
  },
  {
    id: "web_wizard", name: "Web Wizard", description: "Solve all web challenges",
    icon: "🕸️", color: "#4caf50", rarity: "legendary", category: "solve",
    criteria: { type: "category_solved", target: 100, category: "web" }, isActive: true, createdAt: new Date(),
  },
  {
    id: "social_butterfly", name: "Social Butterfly", description: "Collaborate with 5 different teams",
    icon: "🦋", color: "#e91e63", rarity: "uncommon", category: "collaboration",
    criteria: { type: "team_score", target: 5 }, isActive: true, createdAt: new Date(),
  },
  {
    id: "Century", name: "Century Club", description: "Solve 100 challenges total",
    icon: "💯", color: "#ffd700", rarity: "legendary", category: "solve",
    criteria: { type: "challenges_solved", target: 100 }, isActive: true, createdAt: new Date(),
  },
];

export function createBadgeTemplate(input: {
  name: string;
  description: string;
  icon: string;
  category: BadgeTemplate["category"];
  criteria: BadgeCriteria;
  rarity?: BadgeRarity;
  color?: string;
}): BadgeTemplate {
  return {
    id: `badge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color || RARITY_COLORS[input.rarity || "common"],
    rarity: input.rarity || "common",
    category: input.category,
    criteria: input.criteria,
    isActive: true,
    createdAt: new Date(),
  };
}

export function checkBadgeEligibility(
  template: BadgeTemplate,
  userStats: {
    challengesSolved: number;
    categorySolves: Record<string, number>;
    firstBloods: number;
    streakDays: number;
    speedSolves: number;
    hintlessSolves: number;
    teamCollaborations: number;
  }
): { eligible: boolean; progress: number; target: number } {
  const c = template.criteria;
  switch (c.type) {
    case "challenges_solved":
      return { eligible: userStats.challengesSolved >= c.target, progress: userStats.challengesSolved, target: c.target };
    case "category_solved": {
      const count = userStats.categorySolves[c.category || ""] || 0;
      return { eligible: count >= c.target, progress: count, target: c.target };
    }
    case "first_blood":
      return { eligible: userStats.firstBloods >= c.target, progress: userStats.firstBloods, target: c.target };
    case "streak_days":
      return { eligible: userStats.streakDays >= c.target, progress: userStats.streakDays, target: c.target };
    case "speed_demon":
      return { eligible: userStats.speedSolves >= c.target, progress: userStats.speedSolves, target: c.target };
    case "hintless":
      return { eligible: userStats.hintlessSolves >= c.target, progress: userStats.hintlessSolves, target: c.target };
    case "team_score":
      return { eligible: userStats.teamCollaborations >= c.target, progress: userStats.teamCollaborations, target: c.target };
    default:
      return { eligible: false, progress: 0, target: c.target };
  }
}

export function evaluateAllBadges(
  templates: BadgeTemplate[],
  userStats: Parameters<typeof checkBadgeEligibility>[1]
): { newlyEarned: BadgeTemplate[]; inProgress: BadgeProgress[] } {
  const newlyEarned: BadgeTemplate[] = [];
  const inProgress: BadgeProgress[] = [];
  for (const template of templates) {
    if (!template.isActive) continue;
    const result = checkBadgeEligibility(template, userStats);
    if (result.eligible) {
      newlyEarned.push(template);
    } else if (result.progress > 0) {
      inProgress.push({
        templateId: template.id,
        current: result.progress,
        target: result.target,
        percentage: Math.round((result.progress / result.target) * 100),
      });
    }
  }
  return { newlyEarned, inProgress };
}

export function getDefaultBadges(): BadgeTemplate[] {
  return [...DEFAULT_BADGES];
}

export function getRarityColor(rarity: BadgeRarity): string {
  return RARITY_COLORS[rarity];
}

export function getRarityXP(rarity: BadgeRarity): number {
  return RARITY_XP[rarity];
}

export function sortBadgesByRarity(badges: BadgeTemplate[]): BadgeTemplate[] {
  const order: Record<BadgeRarity, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  return [...badges].sort((a, b) => order[a.rarity] - order[b.rarity]);
}

export function getBadgesByCategory(badges: BadgeTemplate[], category: BadgeTemplate["category"]): BadgeTemplate[] {
  return badges.filter((b) => b.category === category);
}
