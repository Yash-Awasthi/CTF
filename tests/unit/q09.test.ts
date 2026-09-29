import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant } from '../../src/lib/challenges/engine';
import q9 from '../../challenges/09/index';

defineChallengeTests({
  slot: 9,
  key: 'the-catalogue',
  title: 'The Catalogue',
  tier: 'medium',
  basePoints: 150,
  attributionEnabled: false,
  customTests: () => {
    describe('Q9 archive files', () => {
      it('serves the suppressed row only inside the oversized CSV, never in page data', async () => {
        const { instance } = await generateChallengeForParticipant(ctx(25_115_000), 9);
        expect(JSON.stringify(instance.publicData)).not.toContain('VALE-M-1882-047');
        const csv = String((await q9.artifact!(instance as any, 'inventory-dolls-figures.csv'))!.body);
        expect(csv.trim().split('\n').pop()).toMatch(/^47,VALE-M-1882-047,/);
        expect(await q9.artifact!(instance as any, 'estate-exterior.jpg')).toBeNull();
      });
    });
  },
});
