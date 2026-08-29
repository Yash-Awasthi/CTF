/**
 * Hint API Endpoint
 * Provides hint operations with rate limiting and team sharing
 */

import type { APIRoute } from 'astro';
import { 
  revealHint, 
  getAvailableHints, 
  calculateHintCost,
  shareHintsWithTeam,
  type Hint,
  type HintState,
  type HintConfig 
} from '../../lib/hint_system';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number = 5): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 60000 }); // 1 minute window
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
    level: 1,
    content: 'Look at the HTTP headers for something unusual.',
    cost: 0,
    autoRevealAt: 0,
    isFree: true,
    metadata: { category: 'nudge', difficulty: 'easy' }
  },
  {
    id: 'hint-2',
    challengeId: 'challenge-1',
    level: 2,
    content: 'The flag is encoded in base64 within a custom header.',
    cost: 50,
    autoRevealAt: 0,
    isFree: false,
    metadata: { category: 'direction', difficulty: 'easy' }
  },
  {
    id: 'hint-3',
    challengeId: 'challenge-1',
    level: 3,
    content: 'Decode the X-Custom-Flag header using base64, then ROT13.',
    cost: 100,
    autoRevealAt: Date.now() + 86400000, // 24 hours
    isFree: false,
    metadata: { category: 'solution', difficulty: 'easy' }
  }
];

// Mock user states (in production, use real DB)
const userStates = new Map<string, HintState>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, userId, challengeId, hintLevel, teamId } = body;
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Try again in 1 minute.' 
      }), { status: 429 });
    }
    
    // Get or create user state
    const stateKey = `${userId}:${challengeId}`;
    let state = userStates.get(stateKey) || {
      userId,
      challengeId,
      revealedHints: [],
      totalCost: 0,
      lastRevealedAt: 0,
      teamId
    };
    
    switch (action) {
      case 'get-available': {
        const available = getAvailableHints(challengeId, hintsDb, state, Date.now());
        return new Response(JSON.stringify({ 
          hints: available.map(h => ({
            ...h,
            cost: calculateHintCost(h, state.revealedHints.length)
          })),
          revealedCount: state.revealedHints.length,
          totalCost: state.totalCost
        }));
      }
      
      case 'reveal': {
        const hint = hintsDb.find(h => 
          h.challengeId === challengeId && h.level === hintLevel
        );
        
        if (!hint) {
          return new Response(JSON.stringify({ 
            error: 'Hint not found' 
          }), { status: 404 });
        }
        
        const result = revealHint(hint, state);
        
        if (!result.success) {
          return new Response(JSON.stringify({ 
            error: result.error 
          }), { status: 400 });
        }
        
        // Update state
        userStates.set(stateKey, result.newState);
        
        // Share with team if enabled
        let sharedWith: string[] = [];
        if (teamId && state.teamId === teamId) {
          const teamMembers = ['user-1', 'user-2', 'user-3']; // Mock team
          const shares = shareHintsWithTeam(hint, teamMembers, userId);
          sharedWith = shares.map(s => s.userId);
        }
        
        return new Response(JSON.stringify({
          hint: hint.content,
          cost: result.cost,
          totalCost: result.newState.totalCost,
          hintsRevealed: result.newState.revealedHints.length,
          sharedWith
        }));
      }
      
      case 'get-cost': {
        const hint = hintsDb.find(h => 
          h.challengeId === challengeId && h.level === hintLevel
        );
        
        if (!hint) {
          return new Response(JSON.stringify({ 
            error: 'Hint not found' 
          }), { status: 404 });
        }
        
        const cost = calculateHintCost(hint, state.revealedHints.length);
        
        return new Response(JSON.stringify({
          level: hint.level,
          cost,
          isFree: hint.isFree || state.revealedHints.length < 1,
          wouldReveal: !state.revealedHints.includes(hintLevel)
        }));
      }
      
      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid action' 
        }), { status: 400 });
    }
  } catch (error) {
    console.error('Hint API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), { status: 500 });
  }
};

export const GET: APIRoute = async ({ url }) => {
  const challengeId = url.searchParams.get('challengeId');
  const userId = url.searchParams.get('userId');
  
  if (!challengeId || !userId) {
    return new Response(JSON.stringify({ 
      error: 'Missing challengeId or userId' 
    }), { status: 400 });
  }
  
  const stateKey = `${userId}:${challengeId}`;
  const state = userStates.get(stateKey) || {
    userId,
    challengeId,
    revealedHints: [],
    totalCost: 0,
    lastRevealedAt: 0
  };
  
  const available = getAvailableHints(challengeId, hintsDb, state, Date.now());
  
  return new Response(JSON.stringify({
    challengeId,
    hints: available.map(h => ({
      level: h.level,
      content: state.revealedHints.includes(h.level) ? h.content : '[Locked]',
      cost: calculateHintCost(h, state.revealedHints.length),
      isRevealed: state.revealedHints.includes(h.level),
      autoRevealAt: h.autoRevealAt
    })),
    stats: {
      revealed: state.revealedHints.length,
      total: hintsDb.filter(h => h.challengeId === challengeId).length,
      totalCost: state.totalCost
    }
  }));
};