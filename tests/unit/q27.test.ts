import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { HIDDEN, SEPARATOR } from '../../challenges/27/index';

/** Decode the invisible line both ways; return the readable reading. */
function reveal(line: string): string {
  const groups = line.split(SEPARATOR);
  const read = (zero: string) => groups.map((g) => String.fromCharCode(parseInt([...g].map((c) => (c === zero ? '0' : '1')).join(''), 2))).join('');
  return [read('​'), read('‌')].find((s) => /^[\x20-\x7e]+$/.test(s))!;
}

defineChallengeTests({
  slot: 27,
  key: 'stop-looking-for-people',
  title: 'Stop Looking for People',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q27 zero-width line', () => {
      it('hides the instruction in a line that prints nothing, for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { prompt } = (await getPublicChallengeData(c, 27)).publicData as { prompt: string };
          const line = prompt.split('\n').find((l) => l.length > 0 && /^[​-‍]+$/.test(l))!;
          expect(reveal(line)).toBe(HIDDEN);
          expect(prompt.toLowerCase()).not.toContain('follow the names');
          expect(prompt).not.toContain('ROLES REMAIN');
        }
      });

      it('accepts the sentence as decoded, full stop included', async () => {
        const c = ctx(25_115_020);
        expect((await validateChallengeAnswer(c, 27, 'Follow the names.')).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 27, 'Stop looking for people.')).correct).toBe(false);
      });
    });
  },
});
