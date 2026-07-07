import { describe, expect, it } from 'vitest';
import { toHex, utf8 } from '../../src/lib/crypto/encoding';
import {
	deriveAttributionSeed,
	deriveChallengeSeed,
	deriveEventKey,
	deriveParticipantSeed,
} from '../../src/lib/crypto/derive';
import {
	resolveEventSecret,
	SecretResolutionError,
} from '../../src/lib/crypto/secrets';

// Fixed development-only test-vector inputs. Changing the derivation algorithm
// MUST change these vectors — that is the point (catches accidental drift).
const SECRET = utf8('test-vector-secret-DO-NOT-USE-0000');
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };
const ROLL = 25_115_000;
const SLOT = 7;

const VEC = {
	eventKey: '91fff895e8b3e1fb06487dce21c44e2c07a551b3969edabc178a5bce911ebf77',
	participantSeed:
		'b234256a1a0b5a7249eea4d29aa2aaa97ea9db443c8ccc5f8be6ebe8d280a57b',
	challengeSeed:
		'cb1db9dbc7b38a5d7db54d265dcb8adfc13c32422b54b874f5ab1f7f23170397',
	attributionSeed:
		'e62511499256ae0b727b16468af72f60fde547de8dfc709de67cec0f127b1a92',
} as const;

describe('secret-version resolution', () => {
	it('resolves v1 to the EVENT_SECRET binding', () => {
		const secret = resolveEventSecret({ EVENT_SECRET: 'hunter2' }, 'v1');
		expect(toHex(secret)).toBe(toHex(utf8('hunter2')));
	});

	it('fails safely on an unknown secret version (no fallback)', () => {
		expect(() => resolveEventSecret({ EVENT_SECRET: 'x' }, 'v99')).toThrow(
			SecretResolutionError,
		);
	});

	it('fails safely when the binding is missing/empty', () => {
		expect(() => resolveEventSecret({}, 'v1')).toThrow(SecretResolutionError);
		expect(() => resolveEventSecret({ EVENT_SECRET: '' }, 'v1')).toThrow(
			SecretResolutionError,
		);
	});

	it('never includes the secret value in the error message', () => {
		try {
			resolveEventSecret({ EVENT_SECRET: 'super-secret-value' }, 'v99');
		} catch (e) {
			expect((e as Error).message).not.toContain('super-secret-value');
		}
	});
});

describe('derivation hierarchy — determinism + stable vectors', () => {
	it('matches fixed event-key vector', async () => {
		expect(toHex(await deriveEventKey(SECRET, EVENT))).toBe(VEC.eventKey);
	});

	it('matches fixed participant-seed vector', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		expect(toHex(await deriveParticipantSeed(ek, ROLL))).toBe(
			VEC.participantSeed,
		);
	});

	it('matches fixed challenge-seed vector', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		const ps = await deriveParticipantSeed(ek, ROLL);
		expect(toHex(await deriveChallengeSeed(ps, SLOT))).toBe(VEC.challengeSeed);
	});

	it('matches fixed attribution-seed vector', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		expect(toHex(await deriveAttributionSeed(ek, SLOT))).toBe(
			VEC.attributionSeed,
		);
	});

	it('is deterministic across repeated derivation', async () => {
		const a = await deriveEventKey(SECRET, EVENT);
		const b = await deriveEventKey(SECRET, EVENT);
		expect(toHex(a)).toBe(toHex(b));
	});
});

describe('derivation invariants', () => {
	it('different event identity → different event key', async () => {
		const a = await deriveEventKey(SECRET, EVENT);
		const b = await deriveEventKey(SECRET, { ...EVENT, slug: 'other-event' });
		expect(toHex(a)).not.toBe(toHex(b));
	});

	it('different secret → different event key', async () => {
		const a = await deriveEventKey(SECRET, EVENT);
		const b = await deriveEventKey(utf8('a-different-secret'), EVENT);
		expect(toHex(a)).not.toBe(toHex(b));
	});

	it('different roll number → different participant seed', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		const a = await deriveParticipantSeed(ek, ROLL);
		const b = await deriveParticipantSeed(ek, ROLL + 1);
		expect(toHex(a)).not.toBe(toHex(b));
	});

	it('different challenge slot → different challenge seed', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		const ps = await deriveParticipantSeed(ek, ROLL);
		const a = await deriveChallengeSeed(ps, 1);
		const b = await deriveChallengeSeed(ps, 2);
		expect(toHex(a)).not.toBe(toHex(b));
	});

	it('challenge seed depends on participant (no cross-participant collision)', async () => {
		const ek = await deriveEventKey(SECRET, EVENT);
		const p1 = await deriveParticipantSeed(ek, ROLL);
		const p2 = await deriveParticipantSeed(ek, ROLL + 1);
		const c1 = await deriveChallengeSeed(p1, SLOT);
		const c2 = await deriveChallengeSeed(p2, SLOT);
		expect(toHex(c1)).not.toBe(toHex(c2));
	});

	it('rejects invalid required inputs', async () => {
		await expect(deriveEventKey(SECRET, { ...EVENT, slug: '' })).rejects.toThrow();
		const ek = await deriveEventKey(SECRET, EVENT);
		await expect(deriveParticipantSeed(ek, -1)).rejects.toThrow();
		const ps = await deriveParticipantSeed(ek, ROLL);
		await expect(deriveChallengeSeed(ps, 0)).rejects.toThrow();
	});
});
