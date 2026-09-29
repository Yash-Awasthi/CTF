import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { MARGIN, PLAINTEXT, SURVIVING, encipher, type Q20Private } from '../../challenges/20/index';

defineChallengeTests({
  slot: 20,
  key: 'mira-remembered-too',
  title: 'Mira Remembered Too',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q20 torn key', () => {
      it('the surviving strip leaves the word shapes of the hint, for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { prompt } = (await getPublicChallengeData(c, 20)).publicData as { prompt: string };
          const { instance } = await generateChallengeForParticipant(c, 20);
          const key = (instance.privateData as Q20Private).key;
          expect(new Set(Object.values(key)).size).toBe(26);
          const strip = new Map([...prompt.matchAll(/([A-Z])→(\S)/g)].map((m) => [m[2], m[1]]));
          expect([...strip.values()].join('')).toBe(SURVIVING);
          const line = prompt.split('\n').find((l) => l.trim() === encipher(PLAINTEXT, key))!;
          const partial = [...line.trim()].map((s) => (s === ' ' ? ' ' : strip.get(s) ?? '_')).join('');
          expect(partial).toBe('I_ CHA_GE_ _HE_ _B_E__ED');
          expect(prompt).toContain(encipher(MARGIN, key));
          for (const letter of 'NOPQRSTUVWXYZ') expect(prompt).not.toContain(`${letter}→`);
        }
        expect((await validateChallengeAnswer(ctx(25_115_000), 20, 'it changes  when observed')).correct).toBe(true);
      });
    });
  },
});
