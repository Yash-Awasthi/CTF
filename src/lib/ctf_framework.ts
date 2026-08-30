/**
 * CTF Framework — Jeopardy-style CTF platform core.
 *
 * Inspired by RootTheBox CTF Framework and tinyctf-platform.
 * Provides challenge management, scoring, team support, and hint system.
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ChallengeCategory = 'web' | 'crypto' | 'forensics' | 'reverse' | 'pwn' | 'misc' | 'osint';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  difficulty: Difficulty;
  points: number;
  flag: string;
  hints: Hint[];
  tags: string[];
  author: string;
  createdAt: Date;
  solves: number;
  isActive: boolean;
}

export interface Hint {
  id: string;
  content: string;
  cost: number;
  order: number;
}

export interface Team {
  id: string;
  name: string;
  members: string[];
  score: number;
  solves: SolveRecord[];
  createdAt: Date;
}

export interface SolveRecord {
  challengeId: string;
  solvedAt: Date;
  points: number;
  hintsUsed: number;
  teamId: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  teamId?: string;
  isAdmin: boolean;
  createdAt: Date;
}

// ============================================================================
// CTF Framework Manager
// ============================================================================

export class CTFFrameworkManager {
  private challenges: Map<string, Challenge> = new Map();
  private teams: Map<string, Team> = new Map();
  private users: Map<string, User> = new Map();
  private solves: SolveRecord[] = [];

  /**
   * Create a new challenge.
   */
  createChallenge(params: {
    title: string;
    description: string;
    category: ChallengeCategory;
    difficulty: Difficulty;
    points: number;
    flag: string;
    hints?: { content: string; cost: number }[];
    tags?: string[];
    author?: string;
  }): Challenge {
    const challenge: Challenge = {
      id: randomBytes(8).toString('hex'),
      title: params.title,
      description: params.description,
      category: params.category,
      difficulty: params.difficulty,
      points: params.points,
      flag: params.flag,
      hints: (params.hints || []).map((h, i) => ({
        id: randomBytes(4).toString('hex'),
        content: h.content,
        cost: h.cost,
        order: i,
      })),
      tags: params.tags || [],
      author: params.author || 'anonymous',
      createdAt: new Date(),
      solves: 0,
      isActive: true,
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /**
   * Submit a flag.
   */
  submitFlag(teamId: string, challengeId: string, submittedFlag: string): {
    correct: boolean;
    points: number;
    message: string;
  } {
    const team = this.teams.get(teamId);
    const challenge = this.challenges.get(challengeId);

    if (!team || !challenge) {
      return { correct: false, points: 0, message: 'Invalid team or challenge' };
    }

    if (!challenge.isActive) {
      return { correct: false, points: 0, message: 'Challenge is not active' };
    }

    // Check if already solved
    const alreadySolved = team.solves.some((s) => s.challengeId === challengeId);
    if (alreadySolved) {
      return { correct: false, points: 0, message: 'Already solved' };
    }

    // Normalize flag comparison
    const normalizedSubmitted = submittedFlag.trim().toLowerCase();
    const normalizedFlag = challenge.flag.trim().toLowerCase();

    if (normalizedSubmitted === normalizedFlag) {
      const hintsUsed = this.getHintsUsed(teamId, challengeId);
      const hintPenalty = hintsUsed * Math.floor(challenge.points * 0.1);
      const points = Math.max(challenge.points - hintPenalty, 10);

      const solve: SolveRecord = {
        challengeId,
        solvedAt: new Date(),
        points,
        hintsUsed,
        teamId,
      };

      team.solves.push(solve);
      team.score += points;
      challenge.solves++;
      this.solves.push(solve);

      return { correct: true, points, message: `Correct! +${points} points` };
    }

    return { correct: false, points: 0, message: 'Incorrect flag' };
  }

  /**
   * Get hints used for a challenge by a team.
   */
  private getHintsUsed(teamId: string, challengeId: string): number {
    // In production, would track hint purchases separately
    return 0;
  }

  /**
   * Create a team.
   */
  createTeam(name: string, creatorId: string): Team {
    const team: Team = {
      id: randomBytes(8).toString('hex'),
      name,
      members: [creatorId],
      score: 0,
      solves: [],
      createdAt: new Date(),
    };

    this.teams.set(team.id, team);
    return team;
  }

  /**
   * Join a team.
   */
  joinTeam(teamId: string, userId: string): boolean {
    const team = this.teams.get(teamId);
    const user = this.users.get(userId);
    if (!team || !user) return false;

    if (team.members.length >= 5) return false;
    if (team.members.includes(userId)) return false;

    team.members.push(userId);
    user.teamId = teamId;
    return true;
  }

  /**
   * Register a user.
   */
  registerUser(username: string, email: string): User {
    const user: User = {
      id: randomBytes(8).toString('hex'),
      username,
      email,
      isAdmin: false,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Get scoreboard.
   */
  getScoreboard(): Team[] {
    return Array.from(this.teams.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const lastSolveA = a.solves[a.solves.length - 1]?.solvedAt.getTime() || 0;
        const lastSolveB = b.solves[b.solves.length - 1]?.solvedAt.getTime() || 0;
        return lastSolveB - lastSolveA;
      });
  }

  /**
   * Get challenges by category.
   */
  getChallengesByCategory(category: ChallengeCategory): Challenge[] {
    return Array.from(this.challenges.values()).filter(
      (c) => c.category === category && c.isActive
    );
  }

  /**
   * Get challenge statistics.
   */
  getChallengeStats(challengeId: string): {
    solves: number;
    solveRate: number;
    avgSolveTime: number;
  } | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return null;

    const challengeSolves = this.solves.filter((s) => s.challengeId === challengeId);
    const totalTime = challengeSolves.reduce((sum, s) => {
      const created = this.challenges.get(challengeId)?.createdAt.getTime() || 0;
      return sum + (s.solvedAt.getTime() - created);
    }, 0);

    return {
      solves: challengeSolves.length,
      solveRate: challengeSolves.length / Math.max(this.teams.size, 1),
      avgSolveTime: challengeSolves.length > 0 ? totalTime / challengeSolves.length : 0,
    };
  }

  /**
   * Get all active challenges.
   */
  getActiveChallenges(): Challenge[] {
    return Array.from(this.challenges.values()).filter((c) => c.isActive);
  }

  /**
   * Get scoreboard summary.
   */
  getScoreboardSummary(): {
    totalTeams: number;
    totalSolves: number;
    totalChallenges: number;
    avgScore: number;
  } {
    const teams = Array.from(this.teams.values());
    const totalScore = teams.reduce((sum, t) => sum + t.score, 0);

    return {
      totalTeams: teams.length,
      totalSolves: this.solves.length,
      totalChallenges: this.challenges.size,
      avgScore: teams.length > 0 ? totalScore / teams.length : 0,
    };
  }
}
