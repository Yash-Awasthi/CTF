/**
 * Flag submission API endpoint.
 *
 * POST /api/submit-flag
 * Body: { challenge_id: number, submitted_flag: string }
 *
 * Compares flags case-insensitively with leetspeak normalization.
 * Applies scoring with hint and time penalties.
 * Rate limits: 5 submissions per minute per user.
 * All logic client-side for now — wire to D1 when backend is ready.
 */
import type { APIRoute } from "astro";

// ── Rate Limiter (in-memory per process) ──────────────────────────────────

const rateLimits = new Map<string, number[]>();

function checkRateLimit(userId: string, maxPerMinute = 5): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const timestamps = rateLimits.get(userId) ?? [];
  const recent = timestamps.filter(t => now - t < windowMs);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  rateLimits.set(userId, recent);
  return true;
}

// ── Flag Comparison ───────────────────────────────────────────────────────

/** Leetspeak normalization: 0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i */
function normalizeFlag(flag: string): string {
  return flag
    .trim()
    .toLowerCase()
    .replace(/[013457@$!]/g, c => {
      const map: Record<string, string> = {
        "0": "o", "1": "i", "3": "e", "4": "a",
        "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
      };
      return map[c] ?? c;
    });
}

// ── Scoring ───────────────────────────────────────────────────────────────

function calculateScore(
  basePoints: number,
  hintsUsed: number,
  timeElapsedMinutes: number,
  eventDurationHours: number = 6,
): number {
  // Hint penalty: 50% per hint (binary — used or not)
  const hintFactor = hintsUsed > 0 ? 0.5 : 1.0;

  // Time penalty: linear decay from 100% to 50% over event duration
  const eventMinutes = eventDurationHours * 60;
  const timeFactor = Math.max(0.5, 1 - (timeElapsedMinutes / eventMinutes) * 0.5);

  // Minimum: 25% of base
  const minScore = Math.floor(basePoints * 0.25);

  const raw = basePoints * timeFactor * hintFactor;
  return Math.max(minScore, Math.floor(raw));
}

// ── Suspicious Pattern Detection ──────────────────────────────────────────

function detectSuspiciousPatterns(submissions: string[]): { suspicious: boolean; reason?: string } {
  if (submissions.length < 3) return { suspicious: false };

  // Check for rapid-fire brute force (all different flags in short time)
  const unique = new Set(submissions);
  if (unique.size === submissions.length && submissions.length >= 5) {
    return { suspicious: true, reason: "Brute force pattern detected" };
  }

  // Check for sequential attempts (flag + "1", flag + "2", etc.)
  const base = submissions[0]?.slice(0, -1);
  if (base && submissions.every(s => s.startsWith(base))) {
    return { suspicious: true, reason: "Sequential pattern detected" };
  }

  return { suspicious: false };
}

// ── Mock Data ─────────────────────────────────────────────────────────────

const CHALLENGE_FLAGS: Record<number, { flag: string; basePoints: number; tier: string }> = {};

// Populate mock flags for all 30 challenges
for (let i = 1; i <= 30; i++) {
  const tier = i <= 8 ? "easy" : i <= 18 ? "medium" : i <= 26 ? "hard" : "capstone";
  CHALLENGE_FLAGS[i] = {
    flag: `case_{${String(i).padStart(2, "0")}}_flag`,
    basePoints: { easy: 100, medium: 200, hard: 350, capstone: 500 }[tier],
    tier,
  };
}

const submissionHistory = new Map<string, string[]>();

// ── API Handler ───────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { challenge_id, submitted_flag } = body;

    // Validate inputs
    if (!challenge_id || typeof challenge_id !== "number") {
      return new Response(JSON.stringify({ error: "Invalid challenge_id" }), { status: 400 });
    }
    if (!submitted_flag || typeof submitted_flag !== "string") {
      return new Response(JSON.stringify({ error: "Invalid flag" }), { status: 400 });
    }

    // Rate limit (use IP as user ID for now)
    const userId = request.headers.get("x-forwarded-for") ?? "anonymous";
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Try again in 1 minute.",
        correct: false,
        points_earned: 0,
      }), { status: 429 });
    }

    // Check challenge exists
    const challenge = CHALLENGE_FLAGS[challenge_id];
    if (!challenge) {
      return new Response(JSON.stringify({ error: "Challenge not found" }), { status: 404 });
    }

    // Track submissions for anti-cheat
    const history = submissionHistory.get(userId) ?? [];
    const normalized = normalizeFlag(submitted_flag);
    history.push(normalized);
    submissionHistory.set(userId, history.slice(-20)); // Keep last 20

    // Anti-cheat check
    const suspicious = detectSuspiciousPatterns(history.slice(-10));
    if (suspicious.suspicious) {
      return new Response(JSON.stringify({
        error: "Suspicious activity detected. Submission blocked.",
        correct: false,
        points_earned: 0,
        reason: suspicious.reason,
      }), { status: 403 });
    }

    // Flag comparison
    const correct = normalizeFlag(challenge.flag) === normalized;

    if (!correct) {
      return new Response(JSON.stringify({
        correct: false,
        points_earned: 0,
        message: "Incorrect flag. Keep investigating.",
        attempts_remaining: Math.max(0, 5 - history.length),
      }), { status: 200 });
    }

    // Calculate score (mock: 0 hints, 30 minutes elapsed)
    const points = calculateScore(challenge.basePoints, 0, 30);

    return new Response(JSON.stringify({
      correct: true,
      points_earned: points,
      message: `Case cracked! +${points} points.`,
      challenge_id,
      tier: challenge.tier,
    }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
};
