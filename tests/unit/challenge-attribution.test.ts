import { describe, expect, it } from 'vitest';
import {
	generateChallengeForParticipant,
	getAttributionOwnershipMap,
	type EngineContext,
} from '../../src/lib/challenges/engine';
import { AttributionConfigError } from '../../src/lib/challenges/errors';
import { ATTRIBUTION_SLOTS } from '../../src/lib/challenges/placeholders';

const ENV = { EVENT_SECRET: 'phase5-test-secret-DO-NOT-USE-00000000' };
const EVENT = { slug: 'case-files-dev-2026', secretVersion: 'v1' };
const ROLLS = Array.from({ length: 116 }, (_, i) => 25_115_000 + i);

function ctx(rollNumber: number, roster = ROLLS): EngineContext {
	return { env: ENV, event: EVENT, rollNumber, roster };
}

const SLOT = ATTRIBUTION_SLOTS[0]; // 8

describe('attribution-enabled challenge integration', () => {
	it('all 116 participants get exactly one unique assigned answer', async () => {
		const answers = new Map<number, string>();
		for (const roll of ROLLS) {
			const { instance } = await generateChallengeForParticipant(ctx(roll), SLOT);
			answers.set(roll, (instance.privateData as { answer: string }).answer);
		}
		expect(answers.size).toBe(116);
		expect(new Set([...answers.values()]).size).toBe(116); // unique
	});

	it('assignment is deterministic (same event+slot reproduces)', async () => {
		const a = await generateChallengeForParticipant(ctx(25_115_050), SLOT);
		const b = await generateChallengeForParticipant(ctx(25_115_050), SLOT);
		expect(a.instance.privateData).toEqual(b.instance.privateData);
	});

	it('ownership map resolves every assigned answer to exactly one roll', async () => {
		const map = await getAttributionOwnershipMap(ctx(25_115_000), SLOT);
		expect(map.size).toBe(116);
		// each participant's own answer maps back to them
		for (const roll of [25_115_000, 25_115_057, 25_115_115]) {
			const { instance } = await generateChallengeForParticipant(ctx(roll), SLOT);
			const ans = (instance.privateData as { answer: string }).answer;
			expect(map.get(ans.trim().toLowerCase())).toBe(roll);
		}
	});

	it('assignment changes with challenge identity (slot)', async () => {
		const s1 = ATTRIBUTION_SLOTS[0];
		const s2 = ATTRIBUTION_SLOTS[1];
		const a = await generateChallengeForParticipant(ctx(25_115_000), s1);
		const b = await generateChallengeForParticipant(ctx(25_115_000), s2);
		expect(a.instance.privateData).not.toEqual(b.instance.privateData);
	});

	it('ordinary challenge has no ownership map', async () => {
		await expect(getAttributionOwnershipMap(ctx(25_115_000), 3)).rejects.toThrow(
			AttributionConfigError,
		);
	});

	it('attribution slot without roster fails cleanly', async () => {
		await expect(
			generateChallengeForParticipant(
				{ env: ENV, event: EVENT, rollNumber: 25_115_000, roster: [] },
				SLOT,
			),
		).rejects.toThrow(AttributionConfigError);
	});
});
