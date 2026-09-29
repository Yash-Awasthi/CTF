/**
 * Hint API Endpoint
 * Provides hint operations with rate limiting and team sharing.
 */

import type { APIRoute } from 'astro';
import {
  getAvailableHints,
  calculateHintCost,
  purchaseHint,
  generateHintPreview,
  type Hint,
  type HintConfig,
} from '../../lib/hint_system';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number = 5): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Mock hint database (in production, use real DB)
const hintsDb: Hint[] = [
  {
    id: 'hint-1',
    challengeId: 'challenge-1',
    content: 'Look at the HTTP headers for something unusual.',
    cost: 0,
    order: 1,
    category: 'nudge',
    revealed: false,
  },
  {
    id: 'hint-2',
    challengeId: 'challenge-1',
    content: 'The flag is encoded in base64 within a custom header.',
    cost: 50,
    order: 2,
    category: 'partial',
    revealed: false,
  },
  {
    id: 'hint-3',
    challengeId: 'challenge-1',
    content: 'Decode the X-Custom-Flag header using base64, then ROT13.',
    cost: 100,
    order: 3,
    category: 'detailed',
    revealed: false,
  },
];

// Mock user state (in production, use real DB)
const userPoints = new Map<string, number>();
const userHintsUsed = new Map<string, number>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, userId, challengeId, hintId } = body as {
      action: string;
      userId: string;
      challengeId: string;
      hintId?: string;
    };

    if (!userId || !challengeId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or challengeId' }),
        { status: 400 },
      );
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again in 1 minute.' }),
        { status: 429 },
      );
    }

    const points = userPoints.get(userId) || 0;
    const hintsUsed = userHintsUsed.get(`${userId}:${challengeId}`) || 0;

    switch (action) {
      case 'get-available': {
        const available = getAvailableHints(hintsDb, userId, undefined, []);
        return new Response(
          JSON.stringify({
            hints: available.map((h) => ({
              ...h,
              cost: calculateHintCost(h.order, hintsUsed),
              preview: generateHintPreview(h, 60),
            })),
            hintsUsed,
          }),
        );
      }

      case 'purchase': {
        if (!hintId) {
          return new Response(
            JSON.stringify({ error: 'Missing hintId' }),
            { status: 400 },
          );
        }

        const hint = hintsDb.find((h) => h.id === hintId && h.challengeId === challengeId);
        if (!hint) {
          return new Response(
            JSON.stringify({ error: 'Hint not found' }),
            { status: 404 },
          );
        }

        const result = purchaseHint(hint, points, hintsUsed);

        if (!result.success) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { status: 400 },
          );
        }

        // Update state
        userPoints.set(userId, result.newPoints);
        userHintsUsed.set(`${userId}:${challengeId}`, hintsUsed + 1);

        return new Response(
          JSON.stringify({
            hint: hint.content,
            cost: result.cost,
            remainingPoints: result.newPoints,
            hintsUsed: hintsUsed + 1,
          }),
        );
      }

      case 'get-cost': {
        if (!hintId) {
          return new Response(
            JSON.stringify({ error: 'Missing hintId' }),
            { status: 400 },
          );
        }

        const hint = hintsDb.find((h) => h.id === hintId && h.challengeId === challengeId);
        if (!hint) {
          return new Response(
            JSON.stringify({ error: 'Hint not found' }),
            { status: 404 },
          );
        }

        const cost = calculateHintCost(hint.order, hintsUsed);

        return new Response(
          JSON.stringify({
            hintId: hint.id,
            cost,
            userPoints: points,
          }),
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Hint API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 },
    );
  }
};

export const GET: APIRoute = async ({ url }) => {
  const challengeId = url.searchParams.get('challengeId');
  const userId = url.searchParams.get('userId');

  if (!challengeId || !userId) {
    return new Response(
      JSON.stringify({ error: 'Missing challengeId or userId' }),
      { status: 400 },
    );
  }

  const hintsUsed = userHintsUsed.get(`${userId}:${challengeId}`) || 0;
  const available = getAvailableHints(hintsDb, userId, undefined, []);

  return new Response(
    JSON.stringify({
      challengeId,
      hints: available.map((h) => ({
        id: h.id,
        content: h.revealed ? h.content : '[Locked]',
        cost: calculateHintCost(h.order, hintsUsed),
        isRevealed: h.revealed,
        category: h.category,
      })),
      stats: {
        hintsUsed,
        total: hintsDb.filter((h) => h.challengeId === challengeId).length,
      },
    }),
  );
};
