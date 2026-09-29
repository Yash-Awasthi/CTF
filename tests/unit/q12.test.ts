import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant } from '../../src/lib/challenges/engine';
import type { Q12Private } from '../../challenges/12/index';

defineChallengeTests({
  slot: 12,
  key: 'daniel-reyes',
  title: 'Daniel Reyes',
  tier: 'medium',
  basePoints: 150,
  attributionEnabled: false,
  customTests: () => {
    describe('Q12 portal', () => {
      it('keeps the answer out of the page and inside the portal listing', async () => {
        for (const roll of [25_115_000, 25_115_050, 25_115_115]) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 12);
          const priv = instance.privateData as Q12Private;
          expect(JSON.stringify(instance.publicData)).not.toContain(priv.answer);
          expect(JSON.stringify(instance.publicData)).toContain(priv.credential);
          expect(priv.listing).toContain(priv.answer);
          expect(priv.listing.filter((f) => f.startsWith('collection-transfer'))).toHaveLength(1);
        }
      });
    });
  },
});
