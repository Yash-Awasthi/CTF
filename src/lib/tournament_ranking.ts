/**
 * Tournament Ranking System
 *
 * Extracted from bracket (inspiration).
 * ELO-based rating system with Swiss tournament support,
 * round-robin, and elimination brackets.
 */

// --- Types ---

export type TournamentFormat = 'round_robin' | 'single_elimination' | 'double_elimination' | 'swiss';
export type MatchResult = 'win' | 'loss' | 'draw';

export interface Team {
  teamId: string;
  name: string;
  elo: number;
}

export interface Match {
  matchId: string;
  team1Id: string;
  team2Id: string;
  team1Score: number;
  team2Score: number;
  roundNum: number;
  isDraft: boolean;
}

export interface TeamStatistics {
  wins: number;
  losses: number;
  draws: number;
  points: number;
  matchesPlayed: number;
}

export interface RankingConfig {
  kFactor: number;     // ELO K-factor
  dFactor: number;     // ELO D-factor
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  addScorePoints: boolean;
}

export interface RankingEntry {
  teamId: string;
  stats: TeamStatistics;
}

export interface TournamentSummary {
  totalTeams: number;
  totalMatches: number;
  matchesPending: number;
  rankings: RankingEntry[];
  leader: string | null;
}

// --- Constants ---

const DEFAULT_CONFIG: RankingConfig = {
  kFactor: 32,
  dFactor: 400,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  addScorePoints: false,
};

// --- ELO Rating ---

export function calculateExpectedScore(
  ratingA: number,
  ratingB: number,
  dFactor: number = 400
): number {
  const ratingDiff = ratingB - ratingA;
  return 1.0 / (1.0 + Math.pow(10.0, ratingDiff / dFactor));
}

export function updateElo(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = 32
): number {
  return currentRating + kFactor * (actualScore - expectedScore);
}

// --- Match Results ---

export function determineMatchResult(match: Match, teamId: string): MatchResult {
  if (teamId === match.team1Id) {
    if (match.team1Score > match.team2Score) return 'win';
    if (match.team1Score < match.team2Score) return 'loss';
    return 'draw';
  }
  if (teamId === match.team2Id) {
    if (match.team2Score > match.team1Score) return 'win';
    if (match.team2Score < match.team1Score) return 'loss';
    return 'draw';
  }
  throw new Error(`Team ${teamId} not in match ${match.matchId}`);
}

export function isDraw(match: Match): boolean {
  return match.team1Score === match.team2Score;
}

export function getWinner(match: Match): string | null {
  if (match.team1Score > match.team2Score) return match.team1Id;
  if (match.team2Score > match.team1Score) return match.team2Id;
  return null;
}

// --- Statistics ---

export function createEmptyStatistics(): TeamStatistics {
  return { wins: 0, losses: 0, draws: 0, points: 0, matchesPlayed: 0 };
}

export function calculateStatistics(
  matches: Match[],
  teamId: string,
  config: RankingConfig = DEFAULT_CONFIG
): TeamStatistics {
  const stats = createEmptyStatistics();

  for (const match of matches) {
    if (match.isDraft) continue;
    if (teamId !== match.team1Id && teamId !== match.team2Id) continue;

    const result = determineMatchResult(match, teamId);
    stats.matchesPlayed++;

    if (result === 'win') {
      stats.wins++;
      stats.points += config.winPoints;
    } else if (result === 'draw') {
      stats.draws++;
      stats.points += config.drawPoints;
    } else {
      stats.losses++;
      stats.points += config.lossPoints;
    }

    if (config.addScorePoints) {
      stats.points += teamId === match.team1Id ? match.team1Score : match.team2Score;
    }
  }

  return stats;
}

export function getWinRate(stats: TeamStatistics): number {
  if (stats.matchesPlayed === 0) return 0;
  return stats.wins / stats.matchesPlayed;
}

// --- Rankings ---

export function calculateRankings(
  teams: Team[],
  matches: Match[],
  config: RankingConfig = DEFAULT_CONFIG
): RankingEntry[] {
  const entries: RankingEntry[] = teams.map(team => ({
    teamId: team.teamId,
    stats: calculateStatistics(matches, team.teamId, config),
  }));

  return entries.sort((a, b) => b.stats.points - a.stats.points);
}

// --- Swiss Tournament ---

export function pairSwissRound(
  teams: Team[],
  matches: Match[],
  _roundNum: number
): Array<[string, string]> {
  // Calculate wins for each team
  const teamWins = new Map<string, number>();
  for (const team of teams) {
    let wins = 0;
    for (const m of matches) {
      if (!m.isDraft && (m.team1Id === team.teamId || m.team2Id === team.teamId)) {
        const winner = getWinner(m);
        if (winner === team.teamId) wins++;
      }
    }
    teamWins.set(team.teamId, wins);
  }

  // Sort by wins descending
  const sorted = [...teams].sort(
    (a, b) => (teamWins.get(b.teamId) || 0) - (teamWins.get(a.teamId) || 0)
  );

  // Pair adjacent teams
  const pairings: Array<[string, string]> = [];
  for (let i = 0; i < sorted.length - 1; i += 2) {
    pairings.push([sorted[i].teamId, sorted[i + 1].teamId]);
  }

  return pairings;
}

export function updateSwissElo(
  team1: Team,
  team2: Team,
  match: Match,
  config: RankingConfig = DEFAULT_CONFIG
): [number, number] {
  const expected1 = calculateExpectedScore(team1.elo, team2.elo, config.dFactor);

  let actual1: number;
  if (match.team1Score > match.team2Score) {
    actual1 = 1.0;
  } else if (match.team1Score < match.team2Score) {
    actual1 = 0.0;
  } else {
    actual1 = 0.5;
  }

  const newElo1 = updateElo(team1.elo, expected1, actual1, config.kFactor);
  const newElo2 = updateElo(team2.elo, 1 - expected1, 1 - actual1, config.kFactor);

  return [newElo1, newElo2];
}

// --- Elimination Brackets ---

export function generateSingleEliminationBracket(
  teamIds: (string | null)[]
): Array<Array<[string | null, string | null]>> {
  const n = teamIds.length;
  if (n < 2) return [];

  // Pad to next power of 2
  let size = 1;
  while (size < n) size *= 2;

  const padded = [...teamIds];
  while (padded.length < size) padded.push(null);

  const rounds: Array<Array<[string | null, string | null]>> = [];
  let current: Array<[string | null, string | null]> = [];

  for (let i = 0; i < padded.length; i += 2) {
    current.push([padded[i], padded[i + 1] || null]);
  }

  while (current.length > 1) {
    rounds.push(current);
    const next: Array<[string | null, string | null]> = [];
    for (let i = 0; i < current.length; i += 2) {
      const m1: Match = { matchId: 't', team1Id: current[i][0] || '', team2Id: current[i][1] || '', team1Score: 1, team2Score: 0, roundNum: 0, isDraft: false };
      const winner1 = getWinner(m1);
      let winner2: string | null = null;
      if (i + 1 < current.length) {
        const m2: Match = { matchId: 't', team1Id: current[i + 1][0] || '', team2Id: current[i + 1][1] || '', team1Score: 1, team2Score: 0, roundNum: 0, isDraft: false };
        winner2 = getWinner(m2);
      }
      next.push([winner1, winner2]);
    }
    current = next;
  }

  rounds.push(current);
  return rounds;
}

// --- Tournament Summary ---

export function getTournamentSummary(
  teams: Team[],
  matches: Match[],
  config: RankingConfig = DEFAULT_CONFIG
): TournamentSummary {
  const rankings = calculateRankings(teams, matches, config);
  const completedMatches = matches.filter(m => !m.isDraft);

  return {
    totalTeams: teams.length,
    totalMatches: completedMatches.length,
    matchesPending: matches.length - completedMatches.length,
    rankings,
    leader: rankings.length > 0 ? rankings[0].teamId : null,
  };
}
