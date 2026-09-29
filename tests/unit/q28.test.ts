import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData } from '../../src/lib/challenges/engine';
import { checkLedger, type Q28Private, type Q28Public } from '../../challenges/28/index';
import { buildFile, type Q26Private } from '../../challenges/26/index';
import { getCodename } from '../../challenges/shared/codenames';

const instanceOf = async (roll: number, slot: number) => (await generateChallengeForParticipant(ctx(roll), slot)).instance;

defineChallengeTests({
  slot: 28,
  key: 'the-ledger',
  title: 'The Ledger',
  tier: 'hard',
  basePoints: 350,
  attributionEnabled: true,
  customTests: () => {
    describe('Q28 ledger', () => {
      it("is rebuilt from this player's own Q10, Q11 answers and codename", async () => {
        for (const roll of [25_115_000, 25_115_064]) {
          const q28 = await instanceOf(roll, 28);
          const { rows } = q28.publicData as Q28Public;
          const { expected } = q28.privateData as Q28Private;
          const q10 = ((await instanceOf(roll, 10)).privateData as { answer: string }).answer;
          const q11 = ((await instanceOf(roll, 11)).privateData as { answer: string }).answer;
          expect(expected.c3s).toBe(q10);
          expect(expected.c3c).toBe(q11);
          expect(expected.c5n).toBe(getCodename(roll));

          const typed = Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, `  ${v.toLowerCase().replace('.', '')} `]));
          expect(checkLedger(rows, expected, typed).every(Boolean)).toBe(true);
          const wrong = { ...typed, c2s: 'SOMEONE ELSE' };
          expect(checkLedger(rows, expected, wrong)).toEqual(rows.map((r) => r.cycle !== '2'));
          expect(JSON.stringify(q28.publicData)).not.toContain(q10);
          expect(JSON.stringify(q28.publicData)).not.toContain((q28.privateData as Q28Private).answer);
        }
      });

      it('plants every fixed name somewhere earlier in the case', async () => {
        const q4 = JSON.stringify((await getPublicChallengeData(ctx(25_115_000), 4)).publicData);
        for (const name of ['JOSIAH MARROW', 'ALBA ROURKE', 'THADDEUS GRIEVE']) expect(q4).toContain(name);
        const q26 = (await instanceOf(25_115_000, 26)).privateData as Q26Private;
        expect(buildFile(q26, q26.reyes[0])).toContain('Ilves');
      });
    });
  },
});
