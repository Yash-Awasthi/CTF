/**
 * CTF scoreboard from ctf-scoreboard — real-time scoring and ranking.
 */
export interface Challenge {
    id: string;
    name: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'insane';
    points: number;
    solves: number;
    firstBlood?: string;
    hintCost: number;
}

export interface SolveRecord {
    teamId: string;
    challengeId: string;
    points: number;
    timestamp: number;
    isCorrect: boolean;
}

export interface Team {
    id: string;
    name: string;
    members: string[];
    score: number;
    lastSolve: number;
    challengeCount: number;
}

export interface ScoreboardEntry {
    rank: number;
    teamId: string;
    teamName: string;
    score: number;
    challengeCount: number;
    lastSolve: number;
    recentSolves: SolveRecord[];
}

const challenges: Map<string, Challenge> = new Map();
const teams: Map<string, Team> = new Map();
const solves: SolveRecord[] = [];

export function addChallenge(challenge: Challenge): void {
    challenges.set(challenge.id, challenge);
}

export function createTeam(id: string, name: string, members: string[]): Team {
    const team: Team = { id, name, members, score: 0, lastSolve: 0, challengeCount: 0 };
    teams.set(id, team);
    return team;
}

export function recordSolve(teamId: string, challengeId: string, points: number): SolveRecord | null {
    const team = teams.get(teamId);
    const challenge = challenges.get(challengeId);
    if (!team || !challenge) return null;

    const existing = solves.find(s => s.teamId === teamId && s.challengeId === challengeId);
    if (existing) return null;

    const solve: SolveRecord = {
        teamId, challengeId, points, timestamp: Date.now(), isCorrect: true,
    };
    solves.push(solve);

    team.score += points;
    team.lastSolve = solve.timestamp;
    team.challengeCount++;

    challenge.solves++;
    if (!challenge.firstBlood) {
        challenge.firstBlood = teamId;
    }

    return solve;
}

export function getScoreboard(): ScoreboardEntry[] {
    const entries: ScoreboardEntry[] = Array.from(teams.values()).map(team => ({
        rank: 0,
        teamId: team.id,
        teamName: team.name,
        score: team.score,
        challengeCount: team.challengeCount,
        lastSolve: team.lastSolve,
        recentSolves: solves.filter(s => s.teamId === team.id).slice(-5),
    }));

    entries.sort((a, b) => b.score - a.score || b.lastSolve - a.lastSolve);
    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries;
}

export function getChallengeSolves(challengeId: string): SolveRecord[] {
    return solves.filter(s => s.challengeId === challengeId);
}

export function getCategoryScoreboard(category: string): ScoreboardEntry[] {
    const catChallenges = new Set<string>();
    for (const [id, c] of challenges) {
        if (c.category === category) catChallenges.add(id);
    }
    const catSolves = solves.filter(s => catChallenges.has(s.challengeId));

    const teamScores: Record<string, { score: number; count: number; lastSolve: number }> = {};
    for (const s of catSolves) {
        if (!teamScores[s.teamId]) teamScores[s.teamId] = { score: 0, count: 0, lastSolve: 0 };
        teamScores[s.teamId].score += s.points;
        teamScores[s.teamId].count++;
        if (s.timestamp > teamScores[s.teamId].lastSolve) teamScores[s.teamId].lastSolve = s.timestamp;
    }

    return Object.entries(teamScores)
        .map(([teamId, data]) => ({
            rank: 0, teamId, teamName: teams.get(teamId)?.name || teamId,
            score: data.score, challengeCount: data.count, lastSolve: data.lastSolve, recentSolves: [],
        }))
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function getStats() {
    return {
        totalTeams: teams.size,
        totalChallenges: challenges.size,
        totalSolves: solves.length,
        avgScore: solves.length > 0 ? solves.reduce((sum, s) => sum + s.points, 0) / teams.size : 0,
        unsolvedChallenges: Array.from(challenges.values()).filter(c => c.solves === 0).length,
    };
}
