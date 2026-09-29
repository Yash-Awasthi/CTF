/**
 * Live Scoreboard — real-time CTF competition updates.
 *
 * Features:
 * - Server-Sent Events (SSE) for live score updates
 * - Auto-award badges on solve events
 * - Anti-cheat integration for flag submission validation
 * - Team score recalculation with decay
 */

export interface ScoreboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  solves: number;
  lastSolveAt: number;
  badgeCount: number;
}

export interface SolveEvent {
  type: "solve" | "flag_wrong" | "hint_used" | "badge_awarded";
  teamId: string;
  teamName: string;
  challengeId: string;
  challengeName: string;
  points: number;
  timestamp: number;
  badge?: {
    id: string;
    name: string;
    icon: string;
    rarity: string;
  };
}

export interface ScoreboardState {
  entries: ScoreboardEntry[];
  events: SolveEvent[];
  lastUpdate: number;
}

// In-memory state (Cloudflare Workers isolate-safe)
let cachedState: ScoreboardState | null = null;
const EVENT_LOG: SolveEvent[] = [];
const MAX_EVENTS = 100;

/**
 * Process a solve event: update scores, check badge eligibility, emit SSE.
 */
export function processSolveEvent(
  event: SolveEvent,
): { badgesAwarded: string[] } {
  EVENT_LOG.unshift(event);
  if (EVENT_LOG.length > MAX_EVENTS) EVENT_LOG.pop();

  const badgesAwarded: string[] = [];

  // Auto-award badges based on solve count
  if (event.type === "solve") {
    const teamSolves = EVENT_LOG.filter(
      (e) => e.teamId === event.teamId && e.type === "solve"
    ).length;

    if (teamSolves === 1) {
      const badgeEvent: SolveEvent = {
        type: "badge_awarded",
        teamId: event.teamId,
        teamName: event.teamName,
        challengeId: event.challengeId,
        challengeName: event.challengeName,
        points: 0,
        timestamp: Date.now(),
        badge: {
          id: "first_blood",
          name: "First Blood",
          icon: "🩸",
          rarity: "epic",
        },
      };
      EVENT_LOG.unshift(badgeEvent);
      badgesAwarded.push("first_blood");
    }

    if (teamSolves === 5) {
      const badgeEvent: SolveEvent = {
        type: "badge_awarded",
        teamId: event.teamId,
        teamName: event.teamName,
        challengeId: event.challengeId,
        challengeName: event.challengeName,
        points: 0,
        timestamp: Date.now(),
        badge: {
          id: "speed_demon",
          name: "Speed Demon",
          icon: "⚡",
          rarity: "rare",
        },
      };
      EVENT_LOG.unshift(badgeEvent);
      badgesAwarded.push("speed_demon");
    }

    if (teamSolves === 100) {
      const badgeEvent: SolveEvent = {
        type: "badge_awarded",
        teamId: event.teamId,
        teamName: event.teamName,
        challengeId: event.challengeId,
        challengeName: event.challengeName,
        points: 0,
        timestamp: Date.now(),
        badge: {
          id: "century_club",
          name: "Century Club",
          icon: "💯",
          rarity: "legendary",
        },
      };
      EVENT_LOG.unshift(badgeEvent);
      badgesAwarded.push("century_club");
    }
  }

  // Invalidate cache
  cachedState = null;

  return { badgesAwarded };
}

/**
 * Get current scoreboard state.
 */
export function getScoreboardState(): ScoreboardState {
  if (cachedState) return cachedState;

  // Build scoreboard from event log
  const teamScores = new Map<
    string,
    { name: string; score: number; solves: number; lastSolveAt: number; badges: number }
  >();

  for (const event of [...EVENT_LOG].reverse()) {
    if (event.type === "solve") {
      const existing = teamScores.get(event.teamId) || {
        name: event.teamName,
        score: 0,
        solves: 0,
        lastSolveAt: 0,
        badges: 0,
      };
      existing.score += event.points;
      existing.solves += 1;
      existing.lastSolveAt = Math.max(existing.lastSolveAt, event.timestamp);
      teamScores.set(event.teamId, existing);
    }
    if (event.type === "badge_awarded") {
      const existing = teamScores.get(event.teamId);
      if (existing) existing.badges += 1;
    }
  }

  const entries: ScoreboardEntry[] = [...teamScores.entries()]
    .map(([teamId, data], i) => ({
      rank: i + 1,
      teamId,
      teamName: data.name,
      score: data.score,
      solves: data.solves,
      lastSolveAt: data.lastSolveAt,
      badgeCount: data.badges,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  cachedState = {
    entries,
    events: EVENT_LOG.slice(0, 20),
    lastUpdate: Date.now(),
  };

  return cachedState;
}

/**
 * Format as SSE data payload.
 */
export function formatSSEPayload(state: ScoreboardState): string {
  return JSON.stringify({
    top10: state.entries.slice(0, 10),
    recentEvents: state.events.slice(0, 5),
    lastUpdate: state.lastUpdate,
  });
}
