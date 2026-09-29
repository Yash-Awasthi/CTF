import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { NOISE } from '../../challenges/14/index';

/** Every shift that turns the cipher into a real date before 1940. */
function candidates(cipher: string): string[] {
  const digits = cipher.replace(/\D/g, '');
  const out: string[] = [];
  for (let k = 0; k < 10; k++) {
    const d = digits.split('').map((x) => (Number(x) - k + 10) % 10).join('');
    const [y, m, day] = [Number(d.slice(0, 4)), Number(d.slice(4, 6)), Number(d.slice(6))];
    const t = new Date(Date.UTC(y, m - 1, day));
    if (m >= 1 && m <= 12 && t.getUTCDate() === day && y < 1940) out.push(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`);
  }
  return out;
}

defineChallengeTests({
  slot: 14,
  key: 'before-vale',
  title: 'Before Vale',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q14 solvable from the page', () => {
      it('trying every shift yields exactly one pre-Vale date, and it is accepted', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { prompt } = (await getPublicChallengeData(c, 14)).publicData as { prompt: string };
          const cipher = prompt.match(/Acquired:\s+(\S+)/)![1];
          expect(cipher.replace(/[\d-]/g, '')).toBe(NOISE);
          const found = candidates(cipher);
          expect(found).toHaveLength(1);
          expect((await validateChallengeAnswer(c, 14, found[0])).correct).toBe(true);
        }
      });
    });
  },
});
