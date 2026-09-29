import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';

defineChallengeTests({
  slot: 20,
  key: 'mira-remembered-too',
  title: 'Mira Remembered Too',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q20 solvable from the page', () => {
      it('decoding the ciphertext with the printed key gives an accepted answer for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { prompt } = (await getPublicChallengeData(c, 20)).publicData as { prompt: string };
          const key = new Map([...prompt.matchAll(/([A-Z])→(\S)/g)].map((m) => [m[2], m[1]]));
          const cipher = prompt.match(/CIPHER: (.+)/)![1];
          const plain = [...cipher].map((ch) => (ch === ' ' ? ' ' : key.get(ch) ?? '?')).join('');
          expect(plain).not.toContain('?');
          expect((await validateChallengeAnswer(c, 20, plain)).correct).toBe(true);
        }
      });
    });
  },
});
