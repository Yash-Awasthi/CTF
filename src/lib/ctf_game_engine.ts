/**
 * CTF Game Engine — Dynamic challenge deployment and game management.
 *
 * Inspired by SolveMe and Tp0t OJ.
 * Provides dynamic flag generation, container deployment,
 * and real-time game management.
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type GameStatus = 'setup' | 'registration' | 'running' | 'paused' | 'finished';

export interface Game {
  id: string;
  name: string;
  description: string;
  status: GameStatus;
  startTime?: Date;
  endTime?: Date;
  maxTeams: number;
  flagFormat: string;
  createdAt: Date;
}

export interface DynamicChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  basePoints: number;
  flagType: 'static' | 'dynamic' | 'per_team';
  flagPattern: string;
  containerImage?: string;
  containerPort?: number;
  maxInstances: number;
  isActive: boolean;
}

export interface ChallengeInstance {
  id: string;
  challengeId: string;
  teamId?: string;
  endpoint: string;
  status: 'deploying' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  expiresAt?: Date;
}

export interface DynamicFlag {
  instanceId: string;
  flag: string;
  generatedAt: Date;
  expiresAt?: Date;
}

// ============================================================================
// CTF Game Engine Manager
// ============================================================================

export class CTFGameEngineManager {
  private games: Map<string, Game> = new Map();
  private challenges: Map<string, DynamicChallenge> = new Map();
  private instances: Map<string, ChallengeInstance> = new Map();
  private flags: Map<string, DynamicFlag> = new Map();

  /**
   * Create a new game.
   */
  createGame(params: {
    name: string;
    description: string;
    maxTeams: number;
    flagFormat: string;
  }): Game {
    const game: Game = {
      id: randomBytes(8).toString('hex'),
      name: params.name,
      description: params.description,
      status: 'setup',
      maxTeams: params.maxTeams,
      flagFormat: params.flagFormat,
      createdAt: new Date(),
    };

    this.games.set(game.id, game);
    return game;
  }

  /**
   * Create a dynamic challenge.
   */
  createChallenge(params: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    basePoints: number;
    flagType: 'static' | 'dynamic' | 'per_team';
    flagPattern: string;
    containerImage?: string;
    containerPort?: number;
    maxInstances?: number;
  }): DynamicChallenge {
    const challenge: DynamicChallenge = {
      id: randomBytes(8).toString('hex'),
      title: params.title,
      description: params.description,
      category: params.category,
      difficulty: params.difficulty,
      basePoints: params.basePoints,
      flagType: params.flagType,
      flagPattern: params.flagPattern,
      containerImage: params.containerImage,
      containerPort: params.containerPort || 8080,
      maxInstances: params.maxInstances || 10,
      isActive: true,
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /**
   * Generate a dynamic flag.
   */
  generateFlag(challengeId: string, teamId?: string): string {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');

    const seed = `${challengeId}:${teamId || 'global'}:${Date.now()}`;
    const flag = `FLAG{${createHash('sha256').update(seed).digest('hex').slice(0, 32)}}`;

    // Store the flag
    const flagEntry: DynamicFlag = {
      instanceId: randomBytes(8).toString('hex'),
      flag,
      generatedAt: new Date(),
      expiresAt: challenge.flagType === 'dynamic' ? new Date(Date.now() + 3600000) : undefined,
    };

    this.flags.set(flag, flagEntry);
    return flag;
  }

  /**
   * Deploy a challenge instance.
   */
  deployInstance(challengeId: string, teamId?: string): ChallengeInstance | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || !challenge.containerImage) return null;

    // Check instance limit
    const activeInstances = Array.from(this.instances.values()).filter(
      (i) => i.challengeId === challengeId && i.status === 'running'
    );

    if (activeInstances.length >= challenge.maxInstances) return null;

    const instance: ChallengeInstance = {
      id: randomBytes(8).toString('hex'),
      challengeId,
      teamId,
      endpoint: `http://localhost:${challenge.containerPort}/${challengeId}/${randomBytes(4).toString('hex')}`,
      status: 'deploying',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    this.instances.set(instance.id, instance);

    // Simulate deployment
    setTimeout(() => {
      instance.status = 'running';
    }, 1000);

    return instance;
  }

  /**
   * Submit a flag.
   */
  submitFlag(gameId: string, teamId: string, challengeId: string, submittedFlag: string): {
    correct: boolean;
    points: number;
    message: string;
  } {
    const game = this.games.get(gameId);
    const challenge = this.challenges.get(challengeId);

    if (!game || !challenge) {
      return { correct: false, points: 0, message: 'Invalid game or challenge' };
    }

    if (game.status !== 'running') {
      return { correct: false, points: 0, message: 'Game is not running' };
    }

    // Check static flag
    if (challenge.flagType === 'static') {
      const flagEntry = this.flags.get(submittedFlag);
      if (flagEntry && flagEntry.instanceId) {
        const instance = this.instances.get(flagEntry.instanceId);
        if (instance && instance.challengeId === challengeId) {
          return { correct: true, points: challenge.basePoints, message: 'Correct!' };
        }
      }
    }

    // Check dynamic flag
    if (challenge.flagType === 'dynamic' || challenge.flagType === 'per_team') {
      const flagEntry = this.flags.get(submittedFlag);
      if (flagEntry) {
        if (flagEntry.expiresAt && flagEntry.expiresAt < new Date()) {
          return { correct: false, points: 0, message: 'Flag expired' };
        }
        return { correct: true, points: challenge.basePoints, message: 'Correct!' };
      }
    }

    return { correct: false, points: 0, message: 'Incorrect flag' };
  }

  /**
   * Start a game.
   */
  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'setup') return false;

    game.status = 'running';
    game.startTime = new Date();
    return true;
  }

  /**
   * End a game.
   */
  endGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'running') return false;

    game.status = 'finished';
    game.endTime = new Date();
    return true;
  }

  /**
   * Get all active challenges.
   */
  getActiveChallenges(): DynamicChallenge[] {
    return Array.from(this.challenges.values()).filter((c) => c.isActive);
  }

  /**
   * Get game statistics.
   */
  getGameStats(gameId: string): {
    totalChallenges: number;
    totalInstances: number;
    activeInstances: number;
    totalFlags: number;
  } {
    const gameChallenges = Array.from(this.challenges.values());
    const gameInstances = Array.from(this.instances.values());

    return {
      totalChallenges: gameChallenges.length,
      totalInstances: gameInstances.length,
      activeInstances: gameInstances.filter((i) => i.status === 'running').length,
      totalFlags: this.flags.size,
    };
  }

  /**
   * Clean up expired instances.
   */
  cleanupExpiredInstances(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [id, instance] of this.instances) {
      if (instance.expiresAt && instance.expiresAt < now) {
        instance.status = 'stopped';
        cleaned++;
      }
    }

    return cleaned;
  }
}
