import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';

defineChallengeTests({
  slot: 14,
  key: 'before-vale',
  title: 'Before Vale',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q14 solvable from the page', () => {
      it('following the printed notation decodes to an accepted date for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { prompt } = (await getPublicChallengeData(c, 14)).publicData as { prompt: string };
          const cipher = prompt.match(/ACQUISITION DATE \(ENCODED\): (\S+)/)![1];
          const d = cipher.replace(/\D/g, '').split('').map((x) => (Number(x) + 7) % 10).join('');
          const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
          expect((await validateChallengeAnswer(c, 14, date)).correct).toBe(true);
        }
      });
    });
  },
});
