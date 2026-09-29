import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { validateChallengeAnswer } from '../../src/lib/challenges/engine';

defineChallengeTests({
  slot: 19,
  key: 'the-same-file',
  title: 'The Same File',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q19 answer as copied from the memo', () => {
      it('accepts the sentence across a line break and without its full stop', async () => {
        const c = ctx(25_115_000);
        const copied = 'I have no direct knowledge of the acquisition timeline prior to the\n  estate sale process';
        expect((await validateChallengeAnswer(c, 19, copied)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 19, 'I was engaged by the estate solicitors in late 2013')).correct).toBe(false);
      });
    });
  },
});
