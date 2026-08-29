/**
 * Challenge Plugin Architecture
 * Inspired by CTFd - extensible challenge types, dynamic scoring, flag validation
 */

export interface ChallengePlugin {
  name: string;
  description: string;
  version: string;
  author: string;
  
  // Plugin lifecycle
  init(): Promise<void>;
  destroy(): Promise<void>;
  
  // Challenge operations
  validateFlag(challengeId: string, flag: string, userId: string): Promise<FlagValidationResult>;
  calculateScore(challengeId: string, userId: string, submissionTime: number): Promise<number>;
  getHints(challengeId: string, userId: string): Promise<Hint[]>;
  
  // Admin operations
  createChallenge(data: ChallengeData): Promise<string>;
  updateChallenge(challengeId: string, data: Partial<ChallengeData>): Promise<void>;
  deleteChallenge(challengeId: string): Promise<void>;
  
  // Scoring
  getLeaderboard(challengeId: string, limit?: number): Promise<LeaderboardEntry[]>;
}

export interface ChallengeData {
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  points: number;
  maxAttempts: number;
  hints: Hint[];
  flag: string;
  flagType: 'static' | 'regex' | 'dynamic';
  metadata: Record<string, any>;
}

export interface Hint {
  id: string;
  content: string;
  cost: number;
  order: number;
}

export interface FlagValidationResult {
  correct: boolean;
  message: string;
  score: number;
  attemptsRemaining: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  solveTime: number;
  rank: number;
}

export interface ChallengePluginConfig {
  pluginPath: string;
  enabled: boolean;
  config: Record<string, any>;
}

// Plugin Registry
export class ChallengePluginRegistry {
  private plugins: Map<string, ChallengePlugin> = new Map();
  private configs: Map<string, ChallengePluginConfig> = new Map();

  async registerPlugin(plugin: ChallengePlugin, config: ChallengePluginConfig): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    await plugin.init();
    this.plugins.set(plugin.name, plugin);
    this.configs.set(plugin.name, config);
    
    console.log(`[ChallengePlugin] Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  async unregisterPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    await plugin.destroy();
    this.plugins.delete(pluginName);
    this.configs.delete(pluginName);
    
    console.log(`[ChallengePlugin] Unregistered plugin: ${pluginName}`);
  }

  getPlugin(pluginName: string): ChallengePlugin | undefined {
    return this.plugins.get(pluginName);
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  async validateFlag(pluginName: string, challengeId: string, flag: string, userId: string): Promise<FlagValidationResult> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    return plugin.validateFlag(challengeId, flag, userId);
  }

  async calculateScore(pluginName: string, challengeId: string, userId: string, submissionTime: number): Promise<number> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    return plugin.calculateScore(challengeId, userId, submissionTime);
  }
}

// Default Static Flag Plugin
export class StaticFlagPlugin implements ChallengePlugin {
  name = 'static-flag';
  description = 'Static flag validation plugin';
  version = '1.0.0';
  author = 'CTF Platform';

  private challenges: Map<string, ChallengeData> = new Map();

  async init(): Promise<void> {
    console.log(`[StaticFlagPlugin] Initialized`);
  }

  async destroy(): Promise<void> {
    this.challenges.clear();
    console.log(`[StaticFlagPlugin] Destroyed`);
  }

  async validateFlag(challengeId: string, flag: string, userId: string): Promise<FlagValidationResult> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return {
        correct: false,
        message: 'Challenge not found',
        score: 0,
        attemptsRemaining: 0
      };
    }

    const normalizedFlag = flag.trim().toLowerCase();
    const normalizedCorrect = challenge.flag.trim().toLowerCase();

    return {
      correct: normalizedFlag === normalizedCorrect,
      message: normalizedFlag === normalizedCorrect ? 'Correct flag!' : 'Incorrect flag',
      score: normalizedFlag === normalizedCorrect ? challenge.points : 0,
      attemptsRemaining: challenge.maxAttempts - 1
    };
  }

  async calculateScore(challengeId: string, userId: string, submissionTime: number): Promise<number> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return 0;

    // Base score from challenge points
    let score = challenge.points;

    // Time bonus (higher score for faster solve)
    const timeBonus = Math.max(0, 1 - (submissionTime / 3600000)); // Bonus for solving within 1 hour
    score = Math.round(score * (0.8 + 0.2 * timeBonus));

    return score;
  }

  async getHints(challengeId: string, userId: string): Promise<Hint[]> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return [];

    return challenge.hints;
  }

  async createChallenge(data: ChallengeData): Promise<string> {
    const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.challenges.set(challengeId, data);
    return challengeId;
  }

  async updateChallenge(challengeId: string, data: Partial<ChallengeData>): Promise<void> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    this.challenges.set(challengeId, { ...challenge, ...data });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    this.challenges.delete(challengeId);
  }

  async getLeaderboard(challengeId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    // Placeholder - in real implementation, this would query the database
    return [];
  }
}

// Dynamic Scoring Plugin
export class DynamicScoringPlugin implements ChallengePlugin {
  name = 'dynamic-scoring';
  description = 'Dynamic scoring plugin based on solve count';
  version = '1.0.0';
  author = 'CTF Platform';

  private challenges: Map<string, ChallengeData> = new Map();
  private solveCounts: Map<string, number> = new Map();

  async init(): Promise<void> {
    console.log(`[DynamicScoringPlugin] Initialized`);
  }

  async destroy(): Promise<void> {
    this.challenges.clear();
    this.solveCounts.clear();
    console.log(`[DynamicScoringPlugin] Destroyed`);
  }

  async validateFlag(challengeId: string, flag: string, userId: string): Promise<FlagValidationResult> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return {
        correct: false,
        message: 'Challenge not found',
        score: 0,
        attemptsRemaining: 0
      };
    }

    const normalizedFlag = flag.trim().toLowerCase();
    const normalizedCorrect = challenge.flag.trim().toLowerCase();

    if (normalizedFlag === normalizedCorrect) {
      // Increment solve count
      const currentCount = this.solveCounts.get(challengeId) || 0;
      this.solveCounts.set(challengeId, currentCount + 1);
    }

    return {
      correct: normalizedFlag === normalizedCorrect,
      message: normalizedFlag === normalizedCorrect ? 'Correct flag!' : 'Incorrect flag',
      score: normalizedFlag === normalizedCorrect ? await this.calculateScore(challengeId, userId, Date.now()) : 0,
      attemptsRemaining: challenge.maxAttempts - 1
    };
  }

  async calculateScore(challengeId: string, userId: string, submissionTime: number): Promise<number> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return 0;

    const solveCount = this.solveCounts.get(challengeId) || 0;
    
    // Dynamic scoring: points decrease as more people solve it
    // Formula: points * (1 - solveCount / maxSolves)
    const maxSolves = 100; // Adjust based on expected participation
    const dynamicFactor = Math.max(0.1, 1 - solveCount / maxSolves);
    
    let score = Math.round(challenge.points * dynamicFactor);

    // Time bonus
    const timeBonus = Math.max(0, 1 - (submissionTime / 3600000));
    score = Math.round(score * (0.8 + 0.2 * timeBonus));

    return score;
  }

  async getHints(challengeId: string, userId: string): Promise<Hint[]> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return [];

    return challenge.hints;
  }

  async createChallenge(data: ChallengeData): Promise<string> {
    const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.challenges.set(challengeId, data);
    this.solveCounts.set(challengeId, 0);
    return challengeId;
  }

  async updateChallenge(challengeId: string, data: Partial<ChallengeData>): Promise<void> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    this.challenges.set(challengeId, { ...challenge, ...data });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    this.challenges.delete(challengeId);
    this.solveCounts.delete(challengeId);
  }

  async getLeaderboard(challengeId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    return [];
  }
}

// Regex Flag Plugin
export class RegexFlagPlugin implements ChallengePlugin {
  name = 'regex-flag';
  description = 'Regex-based flag validation plugin';
  version = '1.0.0';
  author = 'CTF Platform';

  private challenges: Map<string, ChallengeData & { flagRegex: RegExp }> = new Map();

  async init(): Promise<void> {
    console.log(`[RegexFlagPlugin] Initialized`);
  }

  async destroy(): Promise<void> {
    this.challenges.clear();
    console.log(`[RegexFlagPlugin] Destroyed`);
  }

  async validateFlag(challengeId: string, flag: string, userId: string): Promise<FlagValidationResult> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return {
        correct: false,
        message: 'Challenge not found',
        score: 0,
        attemptsRemaining: 0
      };
    }

    const matches = challenge.flagRegex.test(flag);

    return {
      correct: matches,
      message: matches ? 'Correct flag pattern!' : 'Flag does not match expected pattern',
      score: matches ? challenge.points : 0,
      attemptsRemaining: challenge.maxAttempts - 1
    };
  }

  async calculateScore(challengeId: string, userId: string, submissionTime: number): Promise<number> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return 0;

    let score = challenge.points;

    // Time bonus
    const timeBonus = Math.max(0, 1 - (submissionTime / 3600000));
    score = Math.round(score * (0.8 + 0.2 * timeBonus));

    return score;
  }

  async getHints(challengeId: string, userId: string): Promise<Hint[]> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return [];

    return challenge.hints;
  }

  async createChallenge(data: ChallengeData): Promise<string> {
    const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const flagRegex = new RegExp(data.flag, 'i');
    this.challenges.set(challengeId, { ...data, flagRegex });
    return challengeId;
  }

  async updateChallenge(challengeId: string, data: Partial<ChallengeData>): Promise<void> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    const updated = { ...challenge, ...data };
    if (data.flag) {
      updated.flagRegex = new RegExp(data.flag, 'i');
    }
    this.challenges.set(challengeId, updated);
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    this.challenges.delete(challengeId);
  }

  async getLeaderboard(challengeId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    return [];
  }
}