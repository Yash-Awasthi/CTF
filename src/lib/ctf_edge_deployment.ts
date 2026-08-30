/**
 * CTF Edge Deployment — Cloudflare Workers-based CTF infrastructure.
 *
 * Inspired by workers-d1-hono-drizzle-template.
 * Provides edge-deployed challenge hosting with D1 database,
 * Hono API framework, and Drizzle ORM.
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EdgeConfig {
  workerName: string;
  accountId: string;
  databaseId: string;
  kvNamespaceId?: string;
  r2BucketName?: string;
  routes: EdgeRoute[];
}

export interface EdgeRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  middleware?: string[];
}

export interface ChallengeDeployment {
  id: string;
  challengeId: string;
  workerUrl: string;
  status: 'deploying' | 'deployed' | 'error';
  deployedAt: Date;
  region: string;
  customDomain?: string;
}

export interface DatabaseSchema {
  challenges: {
    id: string;
    title: string;
    description: string;
    category: string;
    difficulty: string;
    points: number;
    flagHash: string;
    isActive: boolean;
    createdAt: Date;
  };
  solves: {
    id: string;
    challengeId: string;
    teamId: string;
    solvedAt: Date;
    points: number;
  };
  teams: {
    id: string;
    name: string;
    score: number;
    createdAt: Date;
  };
}

// ============================================================================
// CTF Edge Deployment Manager
// ============================================================================

export class CTFEdgeDeploymentManager {
  private config: EdgeConfig;
  private deployments: Map<string, ChallengeDeployment> = new Map();

  constructor(config?: Partial<EdgeConfig>) {
    this.config = {
      workerName: config?.workerName || 'ctf-edge',
      accountId: config?.accountId || '',
      databaseId: config?.databaseId || '',
      routes: config?.routes || this.getDefaultRoutes(),
    };
  }

  /**
   * Get default routes.
   */
  private getDefaultRoutes(): EdgeRoute[] {
    return [
      { path: '/api/challenges', method: 'GET', handler: 'getChallenges' },
      { path: '/api/challenges/:id', method: 'GET', handler: 'getChallenge' },
      { path: '/api/submit', method: 'POST', handler: 'submitFlag' },
      { path: '/api/scoreboard', method: 'GET', handler: 'getScoreboard' },
      { path: '/api/teams', method: 'POST', handler: 'createTeam' },
      { path: '/api/teams/:id', method: 'GET', handler: 'getTeam' },
    ];
  }

  /**
   * Deploy a challenge to edge.
   */
  deployChallenge(challengeId: string, region: string = 'auto'): ChallengeDeployment {
    const deployment: ChallengeDeployment = {
      id: randomBytes(8).toString('hex'),
      challengeId,
      workerUrl: `https://${this.config.workerName}-${challengeId}.${this.config.accountId}.workers.dev`,
      status: 'deploying',
      deployedAt: new Date(),
      region,
    };

    this.deployments.set(deployment.id, deployment);

    // Simulate deployment
    setTimeout(() => {
      deployment.status = 'deployed';
    }, 2000);

    return deployment;
  }

  /**
   * Generate Drizzle ORM schema for challenges.
   */
  generateDrizzleSchema(): string {
    return `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull(),
  points: integer('points').notNull(),
  flagHash: text('flag_hash').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
});

export const solves = sqliteTable('solves', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  teamId: text('team_id').notNull(),
  solvedAt: text('solved_at').notNull(),
  points: integer('points').notNull(),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  score: integer('score').default(0),
  createdAt: text('created_at').notNull(),
});
`.trim();
  }

  /**
   * Generate Hono API routes.
   */
  generateHonoRoutes(): string {
    return `
import { Hono } from 'hono';
import { challenges, solves, teams } from './schema';
import { db } from './db';

const app = new Hono();

// Get all challenges
app.get('/api/challenges', async (c) => {
  const result = await db.select().from(challenges).where(eq(challenges.isActive, true));
  return c.json(result);
});

// Submit flag
app.post('/api/submit', async (c) => {
  const { challengeId, teamId, flag } = await c.req.json();
  
  // Verify flag
  const challenge = await db.select().from(challenges).where(eq(challenges.id, challengeId));
  if (!challenge[0]) return c.json({ error: 'Challenge not found' }, 404);
  
  const flagHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(flag));
  const hashHex = Array.from(new Uint8Array(flagHash)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (hashHex !== challenge[0].flagHash) {
    return c.json({ correct: false, message: 'Incorrect flag' });
  }
  
  // Record solve
  await db.insert(solves).values({
    id: crypto.randomUUID(),
    challengeId,
    teamId,
    solvedAt: new Date().toISOString(),
    points: challenge[0].points,
  });
  
  // Update team score
  await db.update(teams).set({ score: sql\`\`score + ${challenge[0].points}\`\\``}).where(eq(teams.id, teamId));
  
  return c.json({ correct: true, points: challenge[0].points });
});

// Get scoreboard
app.get('/api/scoreboard', async (c) => {
  const result = await db.select().from(teams).orderBy(desc(teams.score));
  return c.json(result);
});

export default app;
`.trim();
  }

  /**
   * Get all deployments.
   */
  getDeployments(): ChallengeDeployment[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get deployment by ID.
   */
  getDeployment(id: string): ChallengeDeployment | undefined {
    return this.deployments.get(id);
  }

  /**
   * Get statistics.
   */
  getStats(): {
    totalDeployments: number;
    deployedCount: number;
    deployingCount: number;
  } {
    const deployments = Array.from(this.deployments.values());
    return {
      totalDeployments: deployments.length,
      deployedCount: deployments.filter((d) => d.status === 'deployed').length,
      deployingCount: deployments.filter((d) => d.status === 'deploying').length,
    };
  }
}
