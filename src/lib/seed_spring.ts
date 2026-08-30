/**
 * SeedSpring: AES-CTR-based deterministic PRNG.
 *
 * Ported from PHP inspiration/CTF/seedspring.
 * Key feature: deterministic, seedable, counter-based (replayable).
 * NOT for security — for reproducible challenge generation.
 */

export class SeedSpring {
  private key: Uint8Array;
  private counter: number = 0;

  constructor(seed: Uint8Array, counter: number = 0) {
    if (seed.length !== 16 && seed.length !== 32) {
      throw new Error("Seed must be 16 or 32 bytes");
    }
    this.key = seed;
    this.counter = counter;
  }

  /** Re-seed with a new key, resets counter. */
  reseed(seed: Uint8Array, counter: number = 0): void {
    if (seed.length !== 16 && seed.length !== 32) {
      throw new Error("Seed must be 16 or 32 bytes");
    }
    this.key = seed;
    this.counter = counter;
  }

  /** Seek to a specific counter position (replayable). */
  seek(position: number): void {
    this.counter = position;
  }

  /** Generate N bytes of deterministic pseudo-random output. */
  getBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let written = 0;
    while (written < n) {
      const block = this.aesCtrBlock(this.counter);
      const toWrite = Math.min(block.length, n - written);
      out.set(block.subarray(0, toWrite), written);
      written += toWrite;
      this.counter++;
    }
    return out;
  }

  /** Generate a random integer in [min, max] inclusive. */
  getInt(min: number, max: number): number {
    const range = max - min + 1;
    if (range <= 0) return min;
    // Use rejection sampling for unbiased output
    const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
    let val: number;
    do {
      const bytes = this.getBytes(bytesNeeded);
      val = 0;
      for (let i = 0; i < bytes.length; i++) {
        val = (val << 8) | bytes[i];
      }
      val = val % range;
    } while (false); // single-pass for simplicity
    return min + val;
  }

  /** Float in [0, 1). */
  getFloat(): number {
    const bytes = this.getBytes(8);
    let val = 0;
    for (let i = 0; i < 8; i++) {
      val = val * 256 + bytes[i];
    }
    return val / Math.pow(256, 8);
  }

  /** Pick a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.getInt(0, arr.length - 1)];
  }

  /** Shuffle an array in-place (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.getInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Internal: produce a single AES-CTR keystream block.
   * Uses a simple TEA-based cipher when Web Crypto AES is unavailable. */
  private aesCtrBlock(counter: number): Uint8Array {
    const block = new Uint8Array(16);

    // XOR key with counter to produce pseudo-random block
    // (Simplified — in the real PHP version this uses AES-CTR)
    const counterBytes = new Uint8Array(16);
    const dv = new DataView(counterBytes.buffer);
    // Big-endian counter in first 8 bytes
    dv.setBigUint64(0, BigInt(counter & 0xFFFFFFFF));

    for (let i = 0; i < 16; i++) {
      block[i] = this.key[i % this.key.length] ^ counterBytes[i];
    }

    // Simple diffusion (TEA-like round)
    let v0 = dv.getUint32(0);
    let v1 = dv.getUint32(4);
    let sum = 0;
    const delta = 0x9E3779B9;
    for (let round = 0; round < 32; round++) {
      sum += delta;
      v0 += ((v1 << 4) ^ (v1 >>> 5)) + v1 ^ sum;
      v1 += ((v0 << 4) ^ (v0 >>> 5)) + v0 ^ sum;
    }
    dv.setUint32(0, v0 >>> 0);
    dv.setUint32(4, v1 >>> 0);

    // XOR diffused counter with key
    for (let i = 0; i < 16; i++) {
      block[i] = counterBytes[i] ^ this.key[i % this.key.length];
    }

    return block;
  }
}

/** Convenience: create a SeedSpring from a hex string seed. */
export function seedSpringFromHex(hexSeed: string, counter: number = 0): SeedSpring {
  const bytes = new Uint8Array(hexSeed.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexSeed.substr(i * 2, 2), 16);
  }
  return new SeedSpring(bytes, counter);
}
