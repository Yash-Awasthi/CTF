import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getAttributionOwnershipMap, getPublicChallengeData } from '../../src/lib/challenges/engine';
import { normalizeAnswer } from '../../src/lib/validation/answer';

defineChallengeTests({
  slot: 15,
  key: 'the-memo',
  title: "Daniel's Explanation",
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: true,
  customTests: () => {
    describe('Q15 attribution', () => {
      it('gives every participant a distinct 2001 date that maps back to them', async () => {
        const owners = await getAttributionOwnershipMap(ctx(25_115_000), 15);
        const seen = new Set<string>();
        for (let i = 0; i < 116; i++) {
          const roll = 25_115_000 + i;
          const { instance } = await generateChallengeForParticipant(ctx(roll), 15);
          const answer = (instance.privateData as { answer: string }).answer;
          expect(answer).toMatch(/^2001-\d{2}-\d{2}$/);
          expect(owners.get(normalizeAnswer(answer))).toBe(roll);
          seen.add(answer);
        }
        expect(seen.size).toBe(116);
        const pub = JSON.stringify((await getPublicChallengeData(ctx(25_115_000), 15)).publicData);
        expect(pub).not.toContain('2001');
      });
    });
  },
});
