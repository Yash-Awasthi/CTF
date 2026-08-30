/**
 * Entropy Collector — Collect and combine entropy from multiple sources.
 *
 * Inspired by seeded-iching-engine's EntropyCollector.
 * Collects randomness from multiple sources and combines them
 * into a single seed value suitable for PRNG initialization.
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EntropySource {
  name: string;
  isAvailable(): boolean;
  collect(bytes: number): Promise<Uint8Array>;
}

export interface EntropyResult {
  seed: string;
  sources: string[];
  timestamp: Date;
  totalBytes: number;
}

// ============================================================================
// Entropy Sources
// ============================================================================

/**
 * Crypto API entropy source.
 */
export class CryptoEntropySource implements EntropySource {
  name = 'crypto';

  isAvailable(): boolean {
    return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function';
  }

  async collect(bytes: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  }
}

/**
 * Timing jitter entropy source.
 * Uses high-resolution timing differences as entropy.
 */
export class TimingJitterSource implements EntropySource {
  name = 'timing';

  isAvailable(): boolean {
    return true;
  }

  async collect(bytes: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
      const start = performance.now();
      // Busy-wait to capture timing jitter
      let sum = 0;
      for (let j = 0; j < 1000; j++) {
        sum += Math.sqrt(j);
      }
      const elapsed = performance.now() - start;
      buffer[i] = Math.floor(elapsed * 1000) & 0xff;
    }
    return buffer;
  }
}

/**
 * Process-specific entropy source.
 * Uses process ID, memory usage, and uptime.
 */
export class ProcessEntropySource implements EntropySource {
  name = 'process';

  isAvailable(): boolean {
    return typeof process !== 'undefined';
  }

  async collect(bytes: number): Promise<Uint8Array> {
    const data = [
      process.pid.toString(),
      process.uptime().toString(),
      JSON.stringify(process.memoryUsage()),
      Date.now().toString(),
      Math.random().toString(),
    ].join(':');

    const hash = createHash('sha256').update(data).digest();
    return new Uint8Array(hash).slice(0, bytes);
  }
}

/**
 * Event loop entropy source.
 * Uses event loop timing characteristics.
 */
export class EventLoopSource implements EntropySource {
  name = 'eventloop';

  isAvailable(): boolean {
    return true;
  }

  async collect(bytes: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(bytes);
    const timings: number[] = [];

    for (let i = 0; i < bytes; i++) {
      const start = performance.now();
      await new Promise((resolve) => setImmediate(resolve));
      const elapsed = performance.now() - start;
      timings.push(elapsed);
    }

    // Hash the timing data for better entropy distribution
    const timingStr = timings.join(',');
    const hash = createHash('sha256').update(timingStr).digest();
    return new Uint8Array(hash).slice(0, bytes);
  }
}

// ============================================================================
// Entropy Collector
// ============================================================================

export class EntropyCollector {
  private sources: EntropySource[] = [];

  /**
   * Add an entropy source.
   */
  addSource(source: EntropySource): this {
    if (source.isAvailable()) {
      this.sources.push(source);
    }
    return this;
  }

  /**
   * Get available source names.
   */
  getAvailableSources(): string[] {
    return this.sources.map((s) => s.name);
  }

  /**
   * Collect entropy from all registered sources.
   */
  async collect(bytesPerSource: number = 16): Promise<EntropyResult> {
    if (this.sources.length === 0) {
      throw new Error('No entropy sources available');
    }

    const entropyArrays = await Promise.all(
      this.sources.map((source) => source.collect(bytesPerSource))
    );

    const combined = this.combineEntropy(entropyArrays);

    return {
      seed: this.bytesToHex(combined),
      sources: this.sources.map((s) => s.name),
      timestamp: new Date(),
      totalBytes: combined.length,
    };
  }

  /**
   * Collect from a specific source only.
   */
  async collectFrom(sourceName: string, bytes: number = 16): Promise<string> {
    const source = this.sources.find((s) => s.name === sourceName);
    if (!source) throw new Error(`Source ${sourceName} not found`);
    const data = await source.collect(bytes);
    return this.bytesToHex(data);
  }

  /**
   * Combine multiple entropy arrays using XOR.
   * Ensures that even if one source is compromised,
   * the combined entropy is still as strong as the strongest source.
   */
  private combineEntropy(arrays: Uint8Array[]): Uint8Array {
    if (arrays.length === 0) return new Uint8Array(0);

    const maxLength = Math.max(...arrays.map((a) => a.length));
    const combined = new Uint8Array(maxLength);

    for (const arr of arrays) {
      for (let i = 0; i < arr.length; i++) {
        combined[i] ^= arr[i];
      }
    }

    // Final hash to ensure uniform distribution
    return new Uint8Array(
      createHash('sha256').update(combined).digest()
    );
  }

  /**
   * Convert bytes to hex string.
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Create a default entropy collector with all available sources.
 */
export function createDefaultCollector(): EntropyCollector {
  return new EntropyCollector()
    .addSource(new CryptoEntropySource())
    .addSource(new TimingJitterSource())
    .addSource(new ProcessEntropySource())
    .addSource(new EventLoopSource());
}
