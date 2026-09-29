import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import q26, { FILES, type Q26Private } from '../../challenges/26/index';

const file = async (instance: any, name: string) => (await q26.artifact!(instance, name))?.body as string | undefined;

defineChallengeTests({
  slot: 26,
  key: 'daniel-reyes-again',
  title: 'Daniel Reyes, Again',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q26 personnel archive', () => {
      it('enumerating every file by name yields exactly the answer', async () => {
        for (const roll of [25_115_000, 25_115_058, 25_115_115]) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 26);
          const priv = instance.privateData as Q26Private;
          const found: string[] = [];
          let decoys = 0;
          for (let n = 1; n <= FILES; n++) {
            const name = `P-${String(n).padStart(4, '0')}`;
            const body = (await file(instance, `${name}.txt`))!;
            if (/^Name:\s+REYES, DANIEL$/m.test(body)) found.push(name);
            else if (/REYES|REYNOLDS|RAYES/.test(body)) decoys++;
          }
          expect(found.join(', ')).toBe(priv.answer);
          expect(found).toHaveLength(4);
          expect(decoys).toBe(4);
          const index = (await file(instance, 'index.txt'))!;
          expect(index.match(/P-\d{4}/g)!.filter((p) => priv.answer.includes(p))).toEqual([found[3]]);
          expect(JSON.stringify(instance.publicData)).not.toContain(found[0]);
          expect(await file(instance, 'P-0000.txt')).toBeUndefined();
          expect(await file(instance, 'P-0401.txt')).toBeUndefined();
        }
      });

      it('accepts any order and separator, rejects a partial list', async () => {
        const c = ctx(25_115_010);
        const { instance } = await generateChallengeForParticipant(c, 26);
        const ids = (instance.privateData as Q26Private).answer.split(', ');
        expect((await validateChallengeAnswer(c, 26, [...ids].reverse().join(' ').toLowerCase())).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 26, ids.slice(0, 3).join(','))).correct).toBe(false);
        expect((await validateChallengeAnswer(c, 26, '4')).correct).toBe(false);
      });
    });
  },
});
