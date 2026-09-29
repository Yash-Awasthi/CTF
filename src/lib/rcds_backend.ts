/**
 * RCDS-style Challenge Deployment Backend
 *
 * Inspired by rcds — challenge deployment and dynamic infrastructure management.
 * Supports containerized challenge deployment, dynamic resource allocation,
 * and challenge lifecycle management.
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ChallengeStatus = 'pending' | 'deploying' | 'running' | 'stopped' | 'error';

export type BackendType = 'docker' | 'kubernetes' | 'static';

export interface ChallengeSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  basePoints: number;
  flag: string;
  hints: string[];
  author: string;
  tags: string[];
  deployments: DeploymentConfig[];
}

export interface DeploymentConfig {
  type: BackendType;
  image?: string;
  port?: number;
  env?: Record<string, string>;
  resources?: { cpu: string; memory: string };
  maxInstances?: number;
  timeoutSeconds?: number;
}

export interface DeploymentInstance {
  id: string;
  challengeId: string;
  status: ChallengeStatus;
  endpoint?: string;
  createdAt: Date;
  expiresAt?: Date;
  teamId?: string;
  backendType: BackendType;
}

export interface ScoreboardEntry {
  teamId: string;
  teamName: string;
  score: number;
  solves: SolveRecord[];
  lastSolve?: Date;
}

export interface SolveRecord {
  challengeId: string;
  solvedAt: Date;
  points: number;
  hintsUsed: number;
  teamId: string;
}

// ============================================================================
// Backend Base
// ============================================================================

export abstract class BackendBase {
  abstract readonly type: BackendType;

  async patchChallengeSchema(schema: ChallengeSchema): Promise<ChallengeSchema> {
    return schema;
  }

  abstract commit(): Promise<boolean>;
}

// ============================================================================
// Docker Backend
// ============================================================================

export class DockerBackend extends BackendBase {
  readonly type: BackendType = 'docker';

  private instances: Map<string, DeploymentInstance> = new Map();

  async createContainer(challenge: ChallengeSchema, config: DeploymentConfig): Promise<DeploymentInstance> {
    const instanceId = createHash('sha256')
      .update(`${challenge.id}-${Date.now()}`)
      .digest('hex')
      .slice(0, 12);

    const port = config.port || 8080;
    const endpoint = `http://localhost:${port}`;

    const instance: DeploymentInstance = {
      id: instanceId,
      challengeId: challenge.id,
      status: 'deploying',
      endpoint,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (config.timeoutSeconds || 3600) * 1000),
      backendType: 'docker',
    };

    this.instances.set(instanceId, instance);

    // Simulate deployment (in real implementation, would call Docker API)
    setTimeout(() => {
      const inst = this.instances.get(instanceId);
      if (inst) inst.status = 'running';
    }, 1000);

    return instance;
  }

  async destroyContainer(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    instance.status = 'stopped';
    return true;
  }

  async getInstance(instanceId: string): Promise<DeploymentInstance | undefined> {
    return this.instances.get(instanceId);
  }

  async getActiveInstances(challengeId: string): Promise<DeploymentInstance[]> {
    return Array.from(this.instances.values()).filter(
      (i) => i.challengeId === challengeId && i.status === 'running'
    );
  }

  async cleanupExpired(): Promise<number> {
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

  async commit(): Promise<boolean> {
    await this.cleanupExpired();
    return true;
  }
}

// ============================================================================
// Kubernetes Backend
// ============================================================================

export class KubernetesBackend extends BackendBase {
  readonly type: BackendType = 'kubernetes';

  private deployments: Map<string, DeploymentInstance> = new Map();

  generateManifest(challenge: ChallengeSchema, config: DeploymentConfig): Record<string, unknown> {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `chall-${challenge.id}`,
        labels: { challenge: challenge.id, app: 'ctf' },
      },
      spec: {
        replicas: config.maxInstances || 1,
        selector: { matchLabels: { challenge: challenge.id } },
        template: {
          metadata: { labels: { challenge: challenge.id } },
          spec: {
            containers: [
              {
                name: challenge.id,
                image: config.image || `ctf/${challenge.id}:latest`,
                ports: [{ containerPort: config.port || 8080 }],
                env: Object.entries(config.env || {}).map(([k, v]) => ({ name: k, value: v })),
                resources: {
                  limits: { cpu: config.resources?.cpu || '500m', memory: config.resources?.memory || '256Mi' },
                },
              },
            ],
          },
        },
      },
    };
  }

  async createDeployment(challenge: ChallengeSchema, config: DeploymentConfig): Promise<DeploymentInstance> {
    const instanceId = `k8s-${challenge.id}-${Date.now()}`;
    const instance: DeploymentInstance = {
      id: instanceId,
      challengeId: challenge.id,
      status: 'deploying',
      createdAt: new Date(),
      backendType: 'kubernetes',
    };
    this.deployments.set(instanceId, instance);
    return instance;
  }

  async commit(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// Scoreboard
// ============================================================================

export class ChallengeScoreboard {
  private entries: Map<string, ScoreboardEntry> = new Map();
  private solves: SolveRecord[] = [];

  addSolve(record: SolveRecord): void {
    this.solves.push(record);
    const existing = this.entries.get(record.teamId);
    if (existing) {
      existing.score += record.points;
      existing.solves.push(record);
      existing.lastSolve = record.solvedAt;
    } else {
      this.entries.set(record.teamId, {
        teamId: record.teamId,
        teamName: record.teamId,
        score: record.points,
        solves: [record],
        lastSolve: record.solvedAt,
      });
    }
  }

  getRanking(): ScoreboardEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.lastSolve?.getTime() || 0) - (a.lastSolve?.getTime() || 0);
    });
  }

  getTeamScore(teamId: string): number {
    return this.entries.get(teamId)?.score || 0;
  }

  getChallengeSolvers(challengeId: string): SolveRecord[] {
    return this.solves.filter((s) => s.challengeId === challengeId);
  }

  getTotalTeams(): number {
    return this.entries.size;
  }

  getTotalSolves(): number {
    return this.solves.length;
  }
}

// ============================================================================
// Challenge Manager
// ============================================================================

export class ChallengeManager {
  private challenges: Map<string, ChallengeSchema> = new Map();
  private backends: Map<BackendType, BackendBase> = new Map();
  private scoreboard: ChallengeScoreboard;

  constructor() {
    this.scoreboard = new ChallengeScoreboard();
    this.backends.set('docker', new DockerBackend());
    this.backends.set('kubernetes', new KubernetesBackend());
  }

  registerChallenge(schema: ChallengeSchema): void {
    this.challenges.set(schema.id, schema);
  }

  async deployChallenge(challengeId: string, backendType: BackendType = 'docker'): Promise<DeploymentInstance | null> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.deployments.length === 0) return null;

    const config = challenge.deployments.find((d) => d.type === backendType) || challenge.deployments[0];
    const backend = this.backends.get(config.type);

    if (!backend) return null;

    if (config.type === 'docker') {
      return (backend as DockerBackend).createContainer(challenge, config);
    } else if (config.type === 'kubernetes') {
      return (backend as KubernetesBackend).createDeployment(challenge, config);
    }

    return null;
  }

  getChallenge(challengeId: string): ChallengeSchema | undefined {
    return this.challenges.get(challengeId);
  }

  getAllChallenges(): ChallengeSchema[] {
    return Array.from(this.challenges.values());
  }

  getScoreboard(): ScoreboardEntry[] {
    return this.scoreboard.getRanking();
  }
}
