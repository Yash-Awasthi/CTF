/**
 * Deterministic random generator: counter-based HMAC-SHA256 expansion.
 *
 *   block(i) = HMAC(challengeSeed, frame[ RNG_BLOCK, i ])   // 32 bytes each
 *
 * The seed's HMAC key is imported ONCE per generator instance; each block bumps
 * a LOCAL counter. State (counter + leftover bytes from a partial block) lives
 * entirely on the instance — two generators built from the same seed reproduce
 * the identical byte stream, and one generator can never perturb another.
 *
 * All methods are async because Web Crypto HMAC is async in Workers. No
 * Math.random, no Date, no module-global mutable state.
 */
import { DOMAIN } from './constants';
import { frame, u64, utf8 } from './encoding';
import { hmacWith, importHmacKey } from './hmac';

const BLOCK_BYTES = 32;
const RNG_LABEL = utf8(DOMAIN.rngBlock);

export class DeterministicRng {
	readonly #key: CryptoKey;
	#counter = 0;
	#leftover = new Uint8Array(0);

	/** Use {@link createDeterministicRng} — this ctor takes a pre-imported key. */
	constructor(key: CryptoKey) {
		this.#key = key;
	}

	/** Produce the next 32-byte HMAC block and advance the local counter. */
	async #nextBlock(): Promise<Uint8Array> {
		const block = await hmacWith(
			this.#key,
			frame([RNG_LABEL, u64(this.#counter)]),
		);
		this.#counter++;
		return block;
	}

	/**
	 * Deterministic bytes of arbitrary length. Spans multiple HMAC blocks as
	 * needed; a partial block's tail is retained so successive calls form one
	 * contiguous stream. Returns a fresh buffer (never internal state).
	 */
	async bytes(length: number): Promise<Uint8Array> {
		if (!Number.isInteger(length) || length < 0) {
			throw new Error(`bytes: length must be a non-negative integer, got ${length}`);
		}
		if (length === 0) return new Uint8Array(0);

		const out = new Uint8Array(length);
		let filled = 0;

		// Drain any leftover from a previous partial block first.
		if (this.#leftover.length > 0) {
			const take = Math.min(this.#leftover.length, length);
			out.set(this.#leftover.subarray(0, take), 0);
			filled = take;
			this.#leftover = this.#leftover.subarray(take);
		}

		while (filled < length) {
			const block = await this.#nextBlock();
			const need = length - filled;
			if (need >= BLOCK_BYTES) {
				out.set(block, filled);
				filled += BLOCK_BYTES;
			} else {
				out.set(block.subarray(0, need), filled);
				filled += need;
				// Keep the unused tail (copied, so the block can be GC'd) for next call.
				this.#leftover = block.slice(need);
			}
		}
		return out;
	}

	/**
	 * Uniform integer in [0, range) with NO modulo bias, via rejection sampling.
	 * Exposed for targeted bias tests; app code uses {@link int}.
	 */
	async uintBelow(range: bigint): Promise<bigint> {
		if (range <= 0n) throw new Error(`uintBelow: range must be > 0, got ${range}`);
		if (range === 1n) return 0n;

		// Smallest byte count that can hold range-1.
		let nbytes = 1;
		while (1n << BigInt(8 * nbytes) < range) nbytes++;

		const space = 1n << BigInt(8 * nbytes);
		// Largest multiple of range that fits in `space`; values >= this are
		// rejected so the accepted region divides evenly (unbiased).
		const limit = space - (space % range);

		for (;;) {
			const raw = await this.bytes(nbytes);
			let value = 0n;
			for (const b of raw) value = (value << 8n) | BigInt(b);
			if (value < limit) return value % range;
			// else reject and draw again
		}
	}

	/**
	 * Deterministic integer in [minInclusive, maxExclusive). `min` MUST be < `max`
	 * (an empty range throws; `int(5,6)` always returns 5). Negative bounds work.
	 */
	async int(minInclusive: number, maxExclusive: number): Promise<number> {
		if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
			throw new Error('int: bounds must be integers');
		}
		if (minInclusive >= maxExclusive) {
			throw new Error(
				`int: minInclusive (${minInclusive}) must be < maxExclusive (${maxExclusive})`,
			);
		}
		const range = BigInt(maxExclusive) - BigInt(minInclusive);
		const offset = await this.uintBelow(range);
		return minInclusive + Number(offset);
	}

	/** Deterministic element from a non-empty array. Does not mutate input. */
	async choice<T>(items: readonly T[]): Promise<T> {
		if (items.length === 0) throw new Error('choice: empty array');
		const i = await this.int(0, items.length);
		return items[i];
	}

	/**
	 * Deterministic Fisher-Yates shuffle. Returns a NEW array (input untouched).
	 * Same seed + same input → same order. No sort-with-random-comparator.
	 */
	async shuffle<T>(items: readonly T[]): Promise<T[]> {
		const out = items.slice();
		for (let i = out.length - 1; i > 0; i--) {
			const j = await this.int(0, i + 1);
			const tmp = out[i];
			out[i] = out[j];
			out[j] = tmp;
		}
		return out;
	}

	/**
	 * Deterministic sample of `count` distinct elements without replacement.
	 * Partial Fisher-Yates: O(count), input untouched, no duplicate indices.
	 */
	async sample<T>(items: readonly T[], count: number): Promise<T[]> {
		if (!Number.isInteger(count) || count < 0) {
			throw new Error(`sample: count must be a non-negative integer, got ${count}`);
		}
		if (count > items.length) {
			throw new Error(
				`sample: count (${count}) exceeds input size (${items.length})`,
			);
		}
		const pool = items.slice();
		const out: T[] = [];
		for (let i = 0; i < count; i++) {
			const j = await this.int(i, pool.length);
			const tmp = pool[i];
			pool[i] = pool[j];
			pool[j] = tmp;
			out.push(pool[i]);
		}
		return out;
	}

	/** Deterministic string of `length` chars drawn from a non-empty alphabet. */
	async string(length: number, alphabet: string): Promise<string> {
		if (!Number.isInteger(length) || length < 0) {
			throw new Error(`string: length must be a non-negative integer, got ${length}`);
		}
		if (alphabet.length === 0) throw new Error('string: empty alphabet');
		if (length === 0) return '';
		const chars = Array.from(alphabet);
		let out = '';
		for (let i = 0; i < length; i++) out += await this.choice(chars);
		return out;
	}
}

/**
 * Build a deterministic RNG from raw seed bytes (typically a challenge seed).
 * Imports the HMAC key once; the returned instance owns all mutable state.
 */
export async function createDeterministicRng(
	seed: Uint8Array,
): Promise<DeterministicRng> {
	return new DeterministicRng(await importHmacKey(seed));
}
