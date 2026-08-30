/**
 * Attack-Defense CTF Scoring System
 *
 * Extracted from attack-and-defense-ctf-platform (inspiration).
 * Flag management, passive points, team scoring, and competition control.
 */

export interface Team {
  id: string;
  name: string;
  score: number;
  flags_owned: string[];
  flags_submitted: string[];
  services: ServiceStatus[];
}

export interface ServiceStatus {
  service_id: string;
  up: boolean;
  last_check: string;
  flags_planted: number;
}

export interface Flag {
  id: string;
  team_id: string;  // owning team
  service_id: string;
  value: string;
  planted_at: string;
  expires_at: string;
  captured_by?: string;  // team that captured it
  captured_at?: string;
  is_live: boolean;
}

export interface ScoringConfig {
  attack_points: number;      // points for capturing a flag
  defense_points: number;     // points per minute for defending
  service_down_penalty: number; // penalty per minute service is down
  self_flag_penalty: number;  // penalty for submitting own flag
  flag_value_decay: number;   // decay factor per hour after planting
  check_interval_seconds: number;
  passive_points_per_minute: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  attack_points: 100,
  defense_points: 2,
  service_down_penalty: 5,
  self_flag_penalty: 200,
  flag_value_decay: 0.05,
  check_interval_seconds: 300,
  passive_points_per_minute: 1,
};

/**
 * Calculate flag capture score
 */
export function calculateFlagCaptureScore(
  flag: Flag,
  capturing_team_id: string,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): { points: number; is_valid: boolean; reason: string } {
  // Can't capture own flag
  if (flag.team_id === capturing_team_id) {
    return {
      points: -config.self_flag_penalty,
      is_valid: true,
      reason: "Self-flag penalty applied",
    };
  }

  // Flag must be live
  if (!flag.is_live) {
    return { points: 0, is_valid: false, reason: "Flag is no longer live" };
  }

  // Check expiry
  const now = new Date();
  const expires = new Date(flag.expires_at);
  if (now > expires) {
    return { points: 0, is_valid: false, reason: "Flag has expired" };
  }

  // Calculate decay based on age
  const planted = new Date(flag.planted_at);
  const hoursOld = (now.getTime() - planted.getTime()) / (1000 * 60 * 60);
  const decay = Math.pow(1 - config.flag_value_decay, hoursOld);

  const points = Math.round(config.attack_points * decay);

  return {
    points,
    is_valid: true,
    reason: `Captured after ${hoursOld.toFixed(1)} hours (${(decay * 100).toFixed(0)}% value)`,
  };
}

/**
 * Calculate passive defense points
 */
export function calculatePassivePoints(
  team: Team,
  minutes_elapsed: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const services_up = team.services.filter(s => s.up).length;
  const total_services = team.services.length;

  if (total_services === 0) return 0;

  const uptime_ratio = services_up / total_services;
  return Math.round(
    config.passive_points_per_minute * minutes_elapsed * uptime_ratio
  );
}

/**
 * Calculate service down penalty
 */
export function calculateServiceDownPenalty(
  team: Team,
  service_id: string,
  minutes_down: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const service = team.services.find(s => s.service_id === service_id);
  if (service && !service.up) {
    return -(config.service_down_penalty * minutes_down);
  }
  return 0;
}

/**
 * Validate flag format
 */
export function validateFlagFormat(
  flag_value: string,
  format_regex: string = "FLAG\\{[a-zA-Z0-9_-]{16,}\\}",
): boolean {
  try {
    const regex = new RegExp(format_regex);
    return regex.test(flag_value);
  } catch {
    return false;
  }
}

/**
 * Generate unique flag value
 */
export function generateFlagValue(
  team_id: string,
  service_id: string,
  timestamp: number,
): string {
  // Simple deterministic flag generation
  const raw = `${team_id}:${service_id}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `FLAG{${hex}_${team_id.slice(0, 4)}_${service_id.slice(0, 4)}}`;
}

/**
 * Calculate team ranking
 */
export function calculateRankings(teams: Team[]): Array<{
  rank: number;
  team_id: string;
  team_name: string;
  score: number;
  flags_captured: number;
  flags_lost: number;
}> {
  const rankings = teams.map(team => ({
    rank: 0,
    team_id: team.id,
    team_name: team.name,
    score: team.score,
    flags_captured: team.flags_submitted.length,
    flags_lost: team.flags_owned.filter(f =>
      teams.some(t => t.flags_submitted.includes(f))
    ).length,
  }));

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

/**
 * Competition state machine
 */
export type CompetitionPhase =
  | "setup"
  | "registration"
  | "preparation"
  | "running"
  | "pausing"
  | "paused"
  | "final"
  | "ended";

export function getNextPhase(
  current: CompetitionPhase,
  action: string,
): CompetitionPhase | null {
  const transitions: Record<CompetitionPhase, Record<string, CompetitionPhase>> = {
    setup: { start_registration: "registration" },
    registration: { close_registration: "preparation", start: "running" },
    preparation: { start: "running" },
    running: { pause: "pausing", end: "final" },
    pausing: { confirm_pause: "paused", resume: "running" },
    paused: { resume: "running", end: "final" },
    final: { end: "ended" },
    ended: {},
  };

  return transitions[current]?.[action] ?? null;
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  timestamp: string;
  team_id?: string;
  action: string;
  details: string;
  ip_address?: string;
}

export function createAuditEntry(
  action: string,
  details: string,
  team_id?: string,
  ip_address?: string,
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    team_id,
    action,
    details,
    ip_address,
  };
}
