import { describe, expect, it } from 'vitest';
import { toHex, utf8 } from '../../src/lib/crypto/encoding';
import { createDeterministicRng } from '../../src/lib/crypto/rng';
import { deriveChallengeSeed, deriveEventKey, deriveParticipantSeed } from '../../src/lib/crypto/derive';
import { ALPHABETS } from '../../src/lib/crypto/constants';

const SECRET = utf8('test-vector-secret-DO-NOT-USE-0000');
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };

async function challengeSeed(roll = 25_115_000, slot = 7) {
	const ek = await deriveEventKey(SECRET, EVENT);
	const ps = await deriveParticipantSeed(ek, roll);
	return deriveChallengeSeed(ps, slot);
}

// Stable RNG vectors (same fixed inputs as crypto-derive).
const RNG_VEC = {
	block: 'bee4e95eb9d35dd7b8c2ee0c56f16d3e5cf0fa2ad4e55920d760ea8d20bf3e8e',
	int: 90,
	str: 'IUZQDDPHCM',
	shuffle: [1, 3, 4, 2, 8, 6, 5, 7],
} as const;

describe('RNG stable vectors', () => {
	it('first 32-byte block matches vector', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		expect(toHex(await rng.bytes(32))).toBe(RNG_VEC.block);
	});
	it('int/string/shuffle match vectors', async () => {
		expect(await (await createDeterministicRng(await challengeSeed())).int(0, 100)).toBe(RNG_VEC.int);
		expect(await (await createDeterministicRng(await challengeSeed())).string(10, ALPHABETS.upper)).toBe(RNG_VEC.str);
		expect(await (await createDeterministicRng(await challengeSeed())).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual(RNG_VEC.shuffle);
	});
});

describe('RNG determinism + isolation', () => {
	it('same seed → same byte stream', async () => {
		const seed = await challengeSeed();
		const a = await (await createDeterministicRng(seed)).bytes(100);
		const b = await (await createDeterministicRng(seed)).bytes(100);
		expect(toHex(a)).toBe(toHex(b));
	});

	it('different seed → different byte stream', async () => {
		const a = await (await createDeterministicRng(await challengeSeed(25_115_000, 7))).bytes(64);
		const b = await (await createDeterministicRng(await challengeSeed(25_115_001, 7))).bytes(64);
		expect(toHex(a)).not.toBe(toHex(b));
	});

	it('generator instances do not share state', async () => {
		const seed = await challengeSeed();
		const g1 = await createDeterministicRng(seed);
		const g2 = await createDeterministicRng(seed);
		await g1.bytes(500); // advance g1 far
		// g2 is untouched → still equals a fresh generator's stream.
		const g3 = await createDeterministicRng(seed);
		expect(toHex(await g2.bytes(48))).toBe(toHex(await g3.bytes(48)));
	});

	it('streaming across blocks equals one big pull', async () => {
		const seed = await challengeSeed();
		const g1 = await createDeterministicRng(seed);
		const chunks = [
			await g1.bytes(1),
			await g1.bytes(31),
			await g1.bytes(40),
			await g1.bytes(28),
		];
		const joined = new Uint8Array(100);
		let o = 0;
		for (const c of chunks) { joined.set(c, o); o += c.length; }
		const g2 = await createDeterministicRng(seed);
		expect(toHex(joined)).toBe(toHex(await g2.bytes(100)));
	});
});

describe('bytes() edge cases', () => {
	it('length 0 → empty buffer', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		expect((await rng.bytes(0)).length).toBe(0);
	});
	it('rejects negative length', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		await expect(rng.bytes(-1)).rejects.toThrow();
	});
	it('spans multiple HMAC blocks (200 bytes)', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		expect((await rng.bytes(200)).length).toBe(200);
	});
});

describe('int() bounds + validation', () => {
	it('always inside [min, max)', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		for (let i = 0; i < 500; i++) {
			const v = await rng.int(10, 17);
			expect(v).toBeGreaterThanOrEqual(10);
			expect(v).toBeLessThan(17);
		}
	});
	it('single-value range int(5,6) always 5', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		for (let i = 0; i < 20; i++) expect(await rng.int(5, 6)).toBe(5);
	});
	it('negative bounds work', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		for (let i = 0; i < 200; i++) {
			const v = await rng.int(-5, 5);
			expect(v).toBeGreaterThanOrEqual(-5);
			expect(v).toBeLessThan(5);
		}
	});
	it('rejects invalid ranges', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		await expect(rng.int(5, 5)).rejects.toThrow();
		await expect(rng.int(6, 5)).rejects.toThrow();
	});
});

describe('unbiased mapping (rejection sampling correctness)', () => {
	// Awkward ranges that do NOT divide any power of two cleanly. We are not
	// proving perfect randomness — only that every drawn value is in-range and
	// that rejection sampling terminates and covers the full range.
	for (const range of [3, 5, 6, 7, 100, 255, 257, 1000]) {
		it(`range ${range}: all values in [0,${range}) and full coverage`, async () => {
			const rng = await createDeterministicRng(await challengeSeed());
			const seen = new Set<number>();
			for (let i = 0; i < range * 40; i++) {
				const v = await rng.int(0, range);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThan(range);
				seen.add(v);
			}
			// With 40x samples every value should appear at least once.
			expect(seen.size).toBe(range);
		});
	}
});

describe('choice / shuffle / sample / string', () => {
	it('choice rejects empty + does not mutate', async () => {
		const rng = await createDeterministicRng(await challengeSeed());
		await expect(rng.choice([])).rejects.toThrow();
		const arr = [1, 2, 3];
		await rng.choice(arr);
		expect(arr).toEqual([1, 2, 3]);
	});

	it('shuffle: deterministic, preserves elements, no mutation', async () => {
		const seed = await challengeSeed();
		const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const a = await (await createDeterministicRng(seed)).shuffle(input);
		const b = await (await createDeterministicRng(seed)).shuffle(input);
		expect(a).toEqual(b);
		expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // untouched
		expect([...a].sort((x, y) => x - y)).toEqual(input); // same multiset
	});

	it('sample: distinct, deterministic, bounded, no mutation', async () => {
		const seed = await challengeSeed();
		const input = Array.from({ length: 20 }, (_, i) => i);
		const a = await (await createDeterministicRng(seed)).sample(input, 5);
		const b = await (await createDeterministicRng(seed)).sample(input, 5);
		expect(a).toEqual(b);
		expect(new Set(a).size).toBe(5);
		expect(input.length).toBe(20);
		await expect((await createDeterministicRng(seed)).sample(input, 21)).rejects.toThrow();
		await expect((await createDeterministicRng(seed)).sample(input, -1)).rejects.toThrow();
	});

	it('string: deterministic, empty-alphabet + negative-length rejected, len 0 empty', async () => {
		const seed = await challengeSeed();
		const a = await (await createDeterministicRng(seed)).string(16, ALPHABETS.alphanumeric);
		const b = await (await createDeterministicRng(seed)).string(16, ALPHABETS.alphanumeric);
		expect(a).toBe(b);
		expect(a).toHaveLength(16);
		const rng = await createDeterministicRng(seed);
		await expect(rng.string(4, '')).rejects.toThrow();
		await expect(rng.string(-1, ALPHABETS.upper)).rejects.toThrow();
		expect(await rng.string(0, ALPHABETS.upper)).toBe('');
	});
});
