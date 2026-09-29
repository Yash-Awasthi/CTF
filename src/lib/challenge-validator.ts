/**
 * Challenge Validation Middleware — validates flag submissions,
 * applies anti-cheat checks, and records solve metadata.
 */

import type { APIContext } from "astro";
import {
  processSolveEvent,
  type SolveEvent,
} from "../lib/live_scoreboard";
import {
  calculateDynamicPoints,
  areHintsAvailable,
  DEFAULT_DIFFICULTY_CONFIG,
} from "../lib/adaptive_difficulty";

export interface FlagSubmission {
  teamId: string;
  teamName: string;
  challengeId: string;
  flag: string;
  submitTimeMs: number;
  hintsUsed: number;
}

export interface ValidationResult {
  accepted: boolean;
  reason: string;
  points?: number;
  badgesAwarded?: string[];
  newRank?: number;
}

/**
 * Validate a flag submission against anti-cheat rules.
 *
 * Checks:
 * 1. Flag format (non-empty, reasonable length)
 * 2. Submission cooldown (minimum 5s between submissions per team)
 * 3. Duplicate submission detection
 * 4. Hint penalty calculation
 * 5. Dynamic point adjustment
 */
export function validateSubmission(
  submission: FlagSubmission,
  correctFlag: string,
  solveStats: {
    totalTeams: number;
    solvedByTeams: number;
    basePoints: number;
  },
  recentSubmissions: Array<{ teamId: string; timestamp: number; flag: string }>,
): ValidationResult {
  // 1. Flag format check
  if (!submission.flag || submission.flag.trim().length === 0) {
    return { accepted: false, reason: "Empty flag" };
  }

  if (submission.flag.length > 256) {
    return { accepted: false, reason: "Flag too long" };
  }

  // 2. Submission cooldown (5s minimum)
  const lastSubmission = recentSubmissions
    .filter((s) => s.teamId === submission.teamId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (lastSubmission) {
    const cooldownMs = 5_000;
    if (submission.submitTimeMs - lastSubmission.timestamp < cooldownMs) {
      return {
        accepted: false,
        reason: `Submission cooldown: wait ${Math.ceil(
          (cooldownMs - (submission.submitTimeMs - lastSubmission.timestamp)) / 1000
        )}s`,
      };
    }
  }

  // 3. Duplicate submission detection
  const duplicateSubmission = recentSubmissions.find(
    (s) =>
      s.teamId === submission.teamId &&
      s.flag.toLowerCase() === submission.flag.toLowerCase() &&
      submission.submitTimeMs - s.timestamp < 300_000 // 5 min window
  );
  if (duplicateSubmission) {
    return { accepted: false, reason: "Duplicate submission detected" };
  }

  // 4. Check flag
  const isCorrect =
    submission.flag.trim().toLowerCase() === correctFlag.trim().toLowerCase();

  if (!isCorrect) {
    return { accepted: false, reason: "Incorrect flag" };
  }

  // 5. Calculate points with dynamic adjustment and hint penalty
  let points = calculateDynamicPoints(
    solveStats.basePoints,
    solveStats.totalTeams,
    solveStats.solvedByTeams,
    DEFAULT_DIFFICULTY_CONFIG
  );

  // Hint penalty: -15% per hint used
  if (submission.hintsUsed > 0) {
    const penalty = Math.pow(0.85, submission.hintsUsed);
    points = Math.round(points * penalty);
  }

  // 6. Process through scoreboard (auto-badge awarding)
  const solveEvent: SolveEvent = {
    type: "solve",
    teamId: submission.teamId,
    teamName: submission.teamName,
    challengeId: submission.challengeId,
    challengeName: submission.challengeId, // placeholder
    points,
    timestamp: submission.submitTimeMs,
  };

  const { badgesAwarded } = processSolveEvent(solveEvent);

  return {
    accepted: true,
    reason: "Correct flag",
    points,
    badgesAwarded,
  };
}
