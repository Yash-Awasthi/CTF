# Contributing to CTF

Noir-themed cybersecurity challenge platform.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Yash-Awasthi/CTFplayground.git
cd CTF
npm install

# Run tests
npm test

# Start dev server
npm run dev
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | TypeScript | 5.0+ |
| Framework | Astro | 4.0+ |
| Testing | Vitest | 1.0+ |
| Styling | CSS | Vanilla |
| Runtime | Node.js | 18+ |

## Project Structure

```
src/
├── components/       # Astro components
├── layouts/          # Page layouts
├── lib/              # Business logic (TypeScript)
│   ├── auth.ts       # Authentication
│   ├── challenges/   # Challenge registry
│   ├── teams.ts      # Team management
│   └── scoring.ts    # Scoring system
├── pages/            # File-based routing
│   ├── api/          # API endpoints
│   └── *.astro       # Pages
└── styles/           # Global styles
tests/
├── unit/             # Unit tests
└── e2e/              # End-to-end tests
```

## Development Guidelines

### Challenge Development

Challenges are defined in `src/lib/challenges/registry.ts`:

```typescript
// Adding a new challenge
export const challenges: Challenge[] = [
  {
    id: 31,
    key: 'crypto_01',
    title: 'Caesar\'s secrets',
    description: 'Decrypt the message...',
    tier: 'easy',
    baseScore: 100,
    hints: [
      { id: 1, content: 'Try shifting each letter...', cost: 10 },
    ],
    flag: 'flag{caesar_was_here}',
  },
];
```

### Component Development

```astro
---
// Component script (runs at build time)
interface Props {
  title: string;
  tier: 'easy' | 'medium' | 'hard' | 'extreme';
}
const { title, tier } = Astro.props;
---

<div class={`challenge-card tier-${tier}`}>
  <h3>{title}</h3>
  <slot />
</div>

<style>
  .challenge-card {
    background: #0f1423;
    border: 1px solid #1a2035;
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .tier-easy { border-left: 3px solid #00ff88; }
  .tier-medium { border-left: 3px solid #ffaa00; }
  .tier-hard { border-left: 3px solid #ff4444; }
  .tier-extreme { border-left: 3px solid #aa00ff; }
</style>
```

### API Endpoints

API routes live in `src/pages/api/`:

```typescript
// src/pages/api/example.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  
  // Validate input
  if (!body.challenge_id) {
    return new Response(
      JSON.stringify({ error: 'Missing challenge_id' }),
      { status: 400 }
    );
  }
  
  // Process...
  
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200 }
  );
};
```

### Code Style

```typescript
// Use TypeScript strict mode
// - Explicit return types on functions
// - No `any` types
// - Prefer interfaces over type aliases

// Good
function calculateScore(solves: number, hints: number): number {
  return Math.max(0, 100 - (hints * 10));
}

// Bad
function calculateScore(solves, hints) {
  return 100 - (hints * 10);
}
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Styling

The CTF uses a **noir mystery** aesthetic:

```css
:root {
  --bg-primary: #0a0e1a;
  --bg-card: #0f1423;
  --border: #1a2035;
  --accent-green: #00ff88;
  --accent-amber: #ffaa00;
  --accent-red: #ff4444;
  --accent-purple: #aa00ff;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
}
```

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No console.log in production code
- [ ] Responsive design (mobile + desktop)
- [ ] `prefers-reduced-motion` respected
- [ ] Challenge flags not committed (use env vars)

## Commit Messages

```
feat: add hint system with progressive reveals
fix: correct flag comparison for leetspeak
ui: improve challenge card hover animation
test: add flag submission edge cases
docs: update API documentation
```
