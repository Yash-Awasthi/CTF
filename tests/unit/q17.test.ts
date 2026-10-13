import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getAttributionOwnershipMap } from '../../src/lib/challenges/engine';
import { normalizeAnswer } from '../../src/lib/validation/answer';
import { FORGED_MODIFIED, etagFor } from '../../challenges/17/index';

defineChallengeTests({
  slot: 17,
  key: 'the-dead-website',
  title: 'The Dead Website',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: true,
  customTests: () => {
    describe('Q17 attribution', () => {
      it('gives every participant a distinct post-2015 date that maps back to them', async () => {
        const owners = await getAttributionOwnershipMap(ctx(25_115_000), 17);
        const seen = new Set<string>();
        for (let i = 0; i < 116; i++) {
          const roll = 25_115_000 + i;
          const { instance } = await generateChallengeForParticipant(ctx(roll), 17);
          const answer = (instance.privateData as { answer: string }).answer;
          expect(answer).toMatch(/^201[89]-\d{2}-\d{2}$/);
          expect(owners.get(normalizeAnswer(answer))).toBe(roll);
          seen.add(answer);
        }
        expect(seen.size).toBe(116);
      });

      it('the ETag decodes to the answer while Last-Modified stays forged in 2013', async () => {
        const { instance } = await generateChallengeForParticipant(ctx(25_115_040), 17);
        const answer = (instance.privateData as { answer: string }).answer;
        const [mtime, size] = etagFor(answer, 5120).replace(/"/g, '').split('-').map((h) => parseInt(h, 16));
        expect(new Date(mtime * 1000).toISOString().slice(0, 10)).toBe(answer);
        expect(size).toBe(5120);
        expect(FORGED_MODIFIED).toContain('2013');
      });
    });
  },
});
