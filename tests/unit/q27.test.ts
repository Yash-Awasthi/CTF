import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';

defineChallengeTests({
  slot: 27,
  key: 'stop-looking-for-people',
  title: 'Stop Looking for People',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q27 solvable from the page', () => {
      it('accepts the sentence pasted exactly as printed, double spaces and full stop included', async () => {
        const c = ctx(25_115_020);
        const { prompt } = (await getPublicChallengeData(c, 27)).publicData as { prompt: string };
        const pasted = prompt.match(/Follow[^\n]*names\./)![0];
        expect(pasted).toContain('  ');
        expect((await validateChallengeAnswer(c, 27, pasted)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 27, 'FOLLOW THE NAMES')).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 27, 'Stop looking for people.')).correct).toBe(false);
      });
    });
  },
});
