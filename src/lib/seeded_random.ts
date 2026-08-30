/**
 * Seeded Random Number Generator — Deterministic random for CTF challenges.
 *
 * Inspired by seedrandom.js by David Bau.
 * Provides reproducible random sequences for challenge generation,
 * flag obfuscation, and deterministic simulations.
 */

// ============================================================================
// Types
// ============================================================================

export interface RandomSource {
  /** Returns a float in [0, 1) */
  next(): number;
  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number;
  /** Returns a random element from an array */
  pick<T>(array: T[]): T;
  /** Shuffle an array in place */
  shuffle<T>(array: T[]): T[];
  /** Returns a random boolean */
  bool(): boolean;
  /** Returns a random string of given length */
  string(length: number, charset?: string): string;
}

// ============================================================================
// Mulberry32 — Fast seeded PRNG
// ============================================================================

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// SFC32 — Small Fast Counter
// ============================================================================

function sfc32(a: number, b: number, c: number, d: number): () => number {
  let s = [a | 0, b | 0, c | 0, d | 0];
  return () => {
    s[2] = (s[2] + s[3]) | 0;
    s[3] = (s[3] + 1) | 0;
    let t = Math.imul(s[0] ^ (s[0] >>> 2), 5);
    s[1] = s[1] ^ t;
    s[2] = s[2] ^ Math.imul(s[1] ^ (s[1] >>> 16), 7);
    t = Math.imul(s[2] ^ (s[2] >>> 16), 3);
    s[0] = s[0] ^ t;
    s[3] = (s[3] + 1) | 0;
    return (Math.imul(s[1] ^ (s[1] >>> 16), 9) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Seed Hashing — Convert string seed to numeric
// ============================================================================

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed | 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

function hashSeedToFour(seed: string | number): [number, number, number, number] {
  const base = hashSeed(seed);
  return [
    base,
    (base * 0x45d9f3b) | 0,
    (base * 0x1234567) | 0,
    (base * 0x7654321) | 0,
  ];
}

// ============================================================================
// SeededRandom
// ============================================================================

export class SeededRandom implements RandomSource {
  private rng: () => number;
  private _state: number;

  constructor(seed: string | number, algorithm: 'mulberry32' | 'sfc32' = 'mulberry32') {
    this._state = hashSeed(seed);
    if (algorithm === 'sfc32') {
      const [a, b, c, d] = hashSeedToFour(seed);
      this.rng = sfc32(a, b, c, d);
    } else {
      this.rng = mulberry32(this._state);
    }
  }

  next(): number {
    return this.rng();
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  bool(): boolean {
    return this.next() > 0.5;
  }

  string(length: number, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += this.pick([...charset]);
    }
    return result;
  }

  /** Get current internal state for reproducibility */
  getState(): number {
    return this._state;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRandom(seed: string | number, algorithm?: 'mulberry32' | 'sfc32'): SeededRandom {
  return new SeededRandom(seed, algorithm);
}

/**
 * Create a random source that's reproducible across runs.
 * Use this for CTF challenge generation where the same seed = same challenge.
 */
export function challengeRandom(challengeId: string, salt: string = ''): SeededRandom {
  return new SeededRandom(`${challengeId}:${salt}`);
}
