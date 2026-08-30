/**
 * CTF Leaderboard — Rankings, streaks, achievements, and team competition.
 *
 * Provides global, team, category, and time-based leaderboards with
 * streak tracking and achievement badges.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Solve {
  challenge_id: string;
  challenge_title: string;
  category: string;
  difficulty: string;
  points: number;
  solved_at: string;
  username: string;
  hints_used: number;
  time_to_solve: number; // seconds
}

export interface PlayerEntry {
  rank: number;
  username: string;
  team: string;
  score: number;
  solves: number;
  last_solve: string;
  streak: number;
  achievements: string[];
  rank_change: number;
}

export interface TeamEntry {
  rank: number;
  team_name: string;
  members: number;
  total_score: number;
  unique_solves: number;
  best_member: string;
  rank_change: number;
}

export interface CategoryEntry {
  category: string;
  total_solves: number;
  avg_points: number;
  top_scorer: string;
  top_score: number;
  difficulty_distribution: Record<string, number>;
}

export interface Leaderboard {
  generated_at: string;
  total_players: number;
  total_teams: number;
  total_solves: number;
  entries: PlayerEntry[];
  teams: TeamEntry[];
  categories: CategoryEntry[];
}

export const AchievementType = {
  FIRST_BLOOD: 'first_blood',
  SPEED_DEMON: 'speed_demon',
  HINTLESS: 'hintless',
  PERFECT_SCORE: 'perfect_score',
  VERSATILE: 'versatile',
  STREAK_3: 'streak_3',
  STREAK_7: 'streak_7',
  STREAK_14: 'streak_14',
  MARATHON: 'marathon',
  COMEBACK: 'comeback',
} as const;

// ---------------------------------------------------------------------------
// Streak calculation
// ---------------------------------------------------------------------------

export function calculateStreak(solveDates: string[]): number {
  if (!solveDates.length) return 0;

  const dates = new Set<string>();
  for (const d of solveDates) {
    if (d.length >= 10) dates.add(d.slice(0, 10));
  }
  if (dates.size === 0) return 0;

  const sorted = [...dates].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    if ((prev.getTime() - curr.getTime()) === 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Achievement detection
// ---------------------------------------------------------------------------

export function detectAchievements(
  playerSolves: Solve[],
  allSolves: Solve[],
  challengeReleaseTimes: Record<string, string>,
): string[] {
  const achievements: string[] = [];
  if (!playerSolves.length) return achievements;

  // First Blood — first to solve any challenge
  for (const solve of playerSolves) {
    const sorted = allSolves
      .filter(s => s.challenge_id === solve.challenge_id)
      .sort((a, b) => a.solved_at.localeCompare(b.solved_at));
    if (sorted.length && sorted[0].username === solve.username) {
      achievements.push(AchievementType.FIRST_BLOOD);
      break;
    }
  }

  // Speed Demon — solved within 5 minutes
  for (const solve of playerSolves) {
    if (solve.time_to_solve > 0 && solve.time_to_solve <= 300) {
      achievements.push(AchievementType.SPEED_DEMON);
      break;
    }
  }

  // Hintless — 3+ solves without hints
  const hintless = playerSolves.filter(s => s.hints_used === 0);
  if (hintless.length >= 3) achievements.push(AchievementType.HINTLESS);

  // Perfect Score — 500+ points on any challenge
  if (playerSolves.some(s => s.points >= 500)) {
    achievements.push(AchievementType.PERFECT_SCORE);
  }

  // Versatile — 3+ categories
  const categories = new Set(playerSolves.map(s => s.category));
  if (categories.size >= 3) achievements.push(AchievementType.VERSATILE);

  // Streak
  const streak = calculateStreak(playerSolves.map(s => s.solved_at));
  if (streak >= 14) achievements.push(AchievementType.STREAK_14);
  else if (streak >= 7) achievements.push(AchievementType.STREAK_7);
  else if (streak >= 3) achievements.push(AchievementType.STREAK_3);

  // Marathon — 10+ solves in one day
  const dayCounts: Record<string, number> = {};
  for (const s of playerSolves) {
    const day = s.solved_at.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  if (Object.values(dayCounts).some(c => c >= 10)) {
    achievements.push(AchievementType.MARATHON);
  }

  return [...new Set(achievements)];
}

// ---------------------------------------------------------------------------
// Leaderboard generation
// ---------------------------------------------------------------------------

export function generatePlayerLeaderboard(
  allSolves: Solve[],
  challengeReleaseTimes?: Record<string, string>,
): PlayerEntry[] {
  if (!allSolves.length) return [];

  const playerData: Record<string, Solve[]> = {};
  for (const s of allSolves) {
    (playerData[s.username] ??= []).push(s);
  }

  const entries: PlayerEntry[] = Object.entries(playerData).map(([username, solves]) => {
    const score = solves.reduce((sum, s) => sum + s.points, 0);
    const dates = solves.map(s => s.solved_at);
    return {
      rank: 0,
      username,
      team: '',
      score,
      solves: solves.length,
      last_solve: dates.sort().reverse()[0] || '',
      streak: calculateStreak(dates),
      achievements: detectAchievements(solves, allSolves, challengeReleaseTimes || {}),
      rank_change: 0,
    };
  });

  entries.sort((a, b) => b.score - a.score || b.solves - a.solves || a.last_solve.localeCompare(b.last_solve));
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

export function generateTeamLeaderboard(
  allSolves: Solve[],
  teamMembers: Record<string, string[]>,
): TeamEntry[] {
  if (!allSolves.length || !Object.keys(teamMembers).length) return [];

  const entries: TeamEntry[] = Object.entries(teamMembers).map(([teamName, members]) => {
    const teamSolves = allSolves.filter(s => members.includes(s.username));
    const challengeBest: Record<string, number> = {};
    for (const s of teamSolves) {
      challengeBest[s.challenge_id] = Math.max(challengeBest[s.challenge_id] || 0, s.points);
    }

    const memberScores: Record<string, number> = {};
    for (const s of teamSolves) {
      memberScores[s.username] = (memberScores[s.username] || 0) + s.points;
    }
    const bestMember = Object.entries(memberScores).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return {
      rank: 0,
      team_name: teamName,
      members: members.length,
      total_score: Object.values(challengeBest).reduce((a, b) => a + b, 0),
      unique_solves: Object.keys(challengeBest).length,
      best_member: bestMember,
      rank_change: 0,
    };
  });

  entries.sort((a, b) => b.total_score - a.total_score || b.unique_solves - a.unique_solves);
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

export function generateCategoryLeaderboard(allSolves: Solve[]): CategoryEntry[] {
  if (!allSolves.length) return [];

  const catData: Record<string, Solve[]> = {};
  for (const s of allSolves) {
    (catData[s.category] ??= []).push(s);
  }

  const entries: CategoryEntry[] = Object.entries(catData).map(([category, solves]) => {
    const points = solves.map(s => s.points);
    const playerPoints: Record<string, number> = {};
    for (const s of solves) {
      playerPoints[s.username] = (playerPoints[s.username] || 0) + s.points;
    }
    const topScorer = Object.entries(playerPoints).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const diffDist: Record<string, number> = {};
    for (const s of solves) {
      diffDist[s.difficulty] = (diffDist[s.difficulty] || 0) + 1;
    }

    return {
      category,
      total_solves: solves.length,
      avg_points: Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 10) / 10,
      top_scorer: topScorer,
      top_score: playerPoints[topScorer] || 0,
      difficulty_distribution: diffDist,
    };
  });

  entries.sort((a, b) => b.total_solves - a.total_solves);
  return entries;
}

export function generateFullLeaderboard(
  allSolves: Solve[],
  teamMembers?: Record<string, string[]>,
  challengeReleaseTimes?: Record<string, string>,
): Leaderboard {
  return {
    generated_at: new Date().toISOString(),
    total_players: new Set(allSolves.map(s => s.username)).size,
    total_teams: Object.keys(teamMembers || {}).length,
    total_solves: allSolves.length,
    entries: generatePlayerLeaderboard(allSolves, challengeReleaseTimes),
    teams: generateTeamLeaderboard(allSolves, teamMembers || {}),
    categories: generateCategoryLeaderboard(allSolves),
  };
}

// ---------------------------------------------------------------------------
// Rank change tracking
// ---------------------------------------------------------------------------

export function calculateRankChanges(
  current: PlayerEntry[],
  previous: PlayerEntry[],
): PlayerEntry[] {
  const prevRanks = new Map(previous.map(e => [e.username, e.rank]));
  for (const entry of current) {
    const prev = prevRanks.get(entry.username);
    if (prev !== undefined) entry.rank_change = prev - entry.rank;
  }
  return current;
}
