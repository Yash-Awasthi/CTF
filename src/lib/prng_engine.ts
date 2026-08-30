/**
 * Deterministic PRNG Engine for CTF
 * Extracted from: yurandom (Xoroshiro128+ seeded random generator)
 * Patterns: Deterministic randomness, seed-based generation, weighted selection,
 *           UUID generation, shuffle, pastel colors
 */

export class PRNG {
  private s: [number, number];

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      // Hash string to two 64-bit seeds using FNV-1a
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < seed.length; i++) {
        h1 ^= seed.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= seed.charCodeAt(i);
        h2 = Math.imul(h2, 0x01000193);
      }
      this.s = [h1 >>> 0, h2 >>> 0];
    } else {
      this.s = [seed >>> 0, (seed * 0x9e3779b9) >>> 0];
    }
    // Warm up
    for (let i = 0; i < 4; i++) this.next();
  }

  /** Xoroshiro128+ core */
  private next(): number {
    const [s0, s1] = this.s;
    const result = (s0 + s1) >>> 0;
    const t = s1 << 9;

    this.s[0] = s1 ^ (s0 << 23);
    this.s[1] = (s0 ^ t ^ (s0 << 16)) >>> 0;

    return result;
  }

  /** Float between 0 (inclusive) and 1 (exclusive) */
  random(): number {
    return this.next() / 0x100000000;
  }

  /** Integer between min and max (inclusive) */
  int(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /** Boolean with ~50% probability */
  bool(): boolean {
    return this.random() < 0.5;
  }

  /** Pick one item from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick n unique items from an array */
  pickN<T>(arr: T[], n: number): T[] {
    const shuffled = this.shuffle(arr);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  /** Shuffle array (non-mutating, Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Weighted pick: items are [value, weight] tuples */
  weighted<T>(items: [T, number][]): T {
    const totalWeight = items.reduce((sum, [, w]) => sum + w, 0);
    let r = this.random() * totalWeight;
    for (const [value, weight] of items) {
      r -= weight;
      if (r <= 0) return value;
    }
    return items[items.length - 1][0];
  }

  /** Array of n integers between min and max */
  range(n: number, min: number, max: number): number[] {
    return Array.from({ length: n }, () => this.int(min, max));
  }

  /** UUID v4-like deterministic string */
  uuid(): string {
    const hex = () => this.int(0, 15).toString(16);
    const s = (n: number) => Array.from({ length: n }, hex).join('');
    return `${s(8)}-${s(4)}-4${s(3)}-${this.pick(['8', '9', 'a', 'b'])}${s(3)}-${s(12)}`;
  }

  /** Random date between start and end */
  date(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return new Date(startTime + this.random() * (endTime - startTime));
  }

  /** Random pastel HSL color */
  pastel(): string {
    const h = this.int(0, 360);
    const s = this.int(60, 80);
    const l = this.int(75, 90);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  /** Random hex color */
  hexColor(): string {
    return `#${this.int(0, 0xffffff).toString(16).padStart(6, '0')}`;
  }

  /** Gaussian (Box-Muller) random number */
  gaussian(mean: number = 0, stddev: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }
}

// ─── Challenge Generation Helpers ──────────────────────────────────────

/**
 * Generate a random flag for a CTF challenge
 */
export function generateFlag(prng: PRNG, prefix: string = 'FLAG'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const suffix = Array.from({ length: 16 }, () => chars[prng.int(0, chars.length - 1)]).join('');
  return `${prefix}{${suffix}}`;
}

/**
 * Generate a random challenge seed
 */
export function generateChallengeSeed(): number {
  return Date.now() ^ (Math.random() * 0xffffffff);
}

/**
 * Generate deterministic test data for a challenge
 */
export function generateChallengeData(prng: PRNG, size: number): number[] {
  return Array.from({ length: size }, () => prng.int(0, 255));
}

/**
 * Generate a random password with constraints
 */
export function generatePassword(
  prng: PRNG,
  length: number = 16,
  options: { uppercase?: boolean; digits?: boolean; symbols?: boolean } = {},
): string {
  const { uppercase = true, digits = true, symbols = true } = options;
  let chars = 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (digits) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  return Array.from({ length }, () => chars[prng.int(0, chars.length - 1)]).join('');
}

/**
 * Generate a Caesar cipher challenge
 */
export function generateCaesarChallenge(prng: PRNG, plaintext: string): {
  ciphertext: string;
  shift: number;
  plaintext: string;
} {
  const shift = prng.int(1, 25);
  const ciphertext = plaintext
    .split('')
    .map((c) => {
      if (c.match(/[a-z]/i)) {
        const base = c === c.toUpperCase() ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
      }
      return c;
    })
    .join('');

  return { ciphertext, shift, plaintext };
}

/**
 * Generate a random XOR key
 */
export function generateXORKey(prng: PRNG, length: number): number[] {
  return Array.from({ length }, () => prng.int(0, 255));
}

/**
 * XOR encrypt/decrypt data with key
 */
export function xorCrypt(data: number[], key: number[]): number[] {
  return data.map((byte, i) => byte ^ key[i % key.length]);
}
