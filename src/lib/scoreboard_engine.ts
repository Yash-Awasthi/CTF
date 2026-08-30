/**
 * Scoreboard Engine - CTF competition scoring.
 * Extracted from ctfscoreboard (inspiration).
 * Team management, scoring, leaderboards, and competition state.
 */

export interface Team {
  id: string;
  name: string;
  score: number;
  lastSolve: Date | null;
  members: string[];
  inviteCode: string;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  points: number;
  currentPoints: number;
  tags: string[];
  flag: string;
  solves: number;
  firstBlood?: string;
  firstBloodTime?: Date;
}

export interface Solve {
  teamId: string;
  challengeId: string;
  points: number;
  timestamp: Date;
  isCorrect: boolean;
}

export interface ScoreHistory {
  teamId: string;
  score: number;
  timestamp: Date;
}

export class ScoreboardEngine {
  private teams: Map<string, Team> = new Map();
  private challenges: Map<string, Challenge> = new Map();
  private solves: Solve[] = [];
  private scoreHistory: ScoreHistory[] = [];
  private config = {
    dynamicScoring: true,
    decayFactor: 0.95,
    minPoints: 50,
    hintPenalty: 10,
    timeBonus: true,
    timeBonusWindow: 300,
  };

  createTeam(name: string): Team {
    const id = `team_${Date.now().toString(36)}`;
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const team: Team = { id, name, score: 0, lastSolve: null, members: [], inviteCode };
    this.teams.set(id, team);
    return team;
  }

  joinTeam(teamId: string, userId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team || team.members.length >= 5) return false;
    if (!team.members.includes(userId)) team.members.push(userId);
    return true;
  }

  createChallenge(input: Omit<Challenge, 'currentPoints' | 'solves'>): Challenge {
    const challenge: Challenge = { ...input, currentPoints: input.points, solves: 0 };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  submitFlag(teamId: string, challengeId: string, submittedFlag: string): { correct: boolean; points: number } {
    const team = this.teams.get(teamId);
    const challenge = this.challenges.get(challengeId);
    if (!team || !challenge) return { correct: false, points: 0 };

    const normalize = (s: string) => s.trim().toLowerCase();
    const isCorrect = normalize(submittedFlag) === normalize(challenge.flag);

    if (isCorrect) {
      const alreadySolved = this.solves.some(s => s.teamId === teamId && s.challengeId === challengeId && s.isCorrect);
      if (alreadySolved) return { correct: false, points: 0 };

      const points = this.calculatePoints(challenge, team);
      const solve: Solve = { teamId, challengeId, points, timestamp: new Date(), isCorrect: true };
      this.solves.push(solve);
      team.score += points;
      team.lastSolve = new Date();
      challenge.solves++;
      if (!challenge.firstBlood) {
        challenge.firstBlood = teamId;
        challenge.firstBloodTime = new Date();
      }
      this.updateDynamicPoints(challenge);
      this.scoreHistory.push({ teamId, score: team.score, timestamp: new Date() });
      return { correct: true, points };
    }

    this.solves.push({ teamId, challengeId, points: 0, timestamp: new Date(), isCorrect: false });
    return { correct: false, points: 0 };
  }

  calculatePoints(challenge: Challenge, team: Team): number {
    let points = challenge.currentPoints;
    if (this.config.timeBonus) {
      const timeSinceStart = (Date.now() - this.solves[0]?.timestamp.getTime() || 0) / 1000;
      if (timeSinceStart < this.config.timeBonusWindow) {
        points = Math.round(points * 1.1);
      }
    }
    return points;
  }

  updateDynamicPoints(challenge: Challenge): void {
    if (!this.config.dynamicScoring) return;
    const solveRate = challenge.solves / Math.max(this.teams.size, 1);
    challenge.currentPoints = Math.max(
      this.config.minPoints,
      Math.round(challenge.points * Math.pow(this.config.decayFactor, challenge.solves))
    );
  }

  getLeaderboard(): { teamId: string; teamName: string; score: number; solves: number }[] {
    return Array.from(this.teams.values())
      .map(t => ({ teamId: t.id, teamName: t.name, score: t.score, solves: this.solves.filter(s => s.teamId === t.id && s.isCorrect).length }))
      .sort((a, b) => b.score - a.score);
  }

  getTeamStats(teamId: string): { score: number; solves: number; challenges: string[] } {
    const teamSolves = this.solves.filter(s => s.teamId === teamId && s.isCorrect);
    return {
      score: this.teams.get(teamId)?.score || 0,
      solves: teamSolves.length,
      challenges: teamSolves.map(s => s.challengeId),
    };
  }

  getChallengeStats(): { total: number; solved: number; unsolved: number; avgSolves: number } {
    const challenges = Array.from(this.challenges.values());
    const solved = challenges.filter(c => c.solves > 0).length;
    return {
      total: challenges.length,
      solved,
      unsolved: challenges.length - solved,
      avgSolves: challenges.reduce((sum, c) => sum + c.solves, 0) / Math.max(challenges.length, 1),
    };
  }

  getScoreHistory(teamId: string): ScoreHistory[] {
    return this.scoreHistory.filter(h => h.teamId === teamId);
  }
}
