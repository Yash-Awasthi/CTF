import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant } from '../../src/lib/challenges/engine';
import q10, { type Q10Private } from '../../challenges/10/index';
import { sameMarks } from '../../challenges/shared/portrait';

const marksDiffer = (a: object, b: object) =>
  Object.keys(a).filter((k) => (a as any)[k] !== (b as any)[k]).length;

defineChallengeTests({
  slot: 10,
  key: 'doll-number-six',
  title: 'The Sitter',
  tier: 'medium',
  basePoints: 150,
  attributionEnabled: false,
  customTests: () => {
    describe('Q10 image comparison', () => {
      it('has exactly one matching photograph and each decoy differs by one mark', async () => {
        for (let i = 0; i < 20; i++) {
          const { instance } = await generateChallengeForParticipant(ctx(25_115_000 + i), 10);
          const priv = instance.privateData as Q10Private;
          const matches = priv.entries.filter((e) => sameMarks(e.marks, priv.doll));
          expect(matches).toHaveLength(1);
          expect(matches[0].file).toBe(priv.answer);
          for (const e of priv.entries) if (e !== matches[0]) expect(marksDiffer(e.marks, priv.doll)).toBe(1);
          expect(new Set(priv.entries.map((e) => e.file)).size).toBe(6);
          expect(priv.entries.some((e) => e.register === 71)).toBe(false);
        }
      });

      it('keeps the answer out of page text and in the register image only', async () => {
        const { instance } = await generateChallengeForParticipant(ctx(25_115_003), 10);
        const priv = instance.privateData as Q10Private;
        expect(JSON.stringify(instance.publicData)).not.toContain(priv.answer);
        const register = (await q10.artifact!(instance as any, 'register.svg'))!;
        const doll = (await q10.artifact!(instance as any, 'doll.svg'))!;
        expect(String(register.body)).toContain(priv.answer);
        expect(String(doll.body)).not.toContain('MP-78');
        expect(await q10.artifact!(instance as any, 'other.svg')).toBeNull();
      });

      it('personalises the answer', async () => {
        const answers = new Set<string>();
        for (let i = 0; i < 10; i++) {
          const { instance } = await generateChallengeForParticipant(ctx(25_115_000 + i), 10);
          answers.add((instance.privateData as Q10Private).answer);
        }
        expect(answers.size).toBeGreaterThan(8);
      });
    });
  },
});
