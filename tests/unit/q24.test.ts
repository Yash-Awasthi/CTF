import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import type { Q24Private } from '../../challenges/24/index';

const answerOf = async (roll: number, slot: number) =>
  ((await generateChallengeForParticipant(ctx(roll), slot)).instance.privateData as { answer: string }).answer;

defineChallengeTests({
  slot: 24,
  key: 'case-closed',
  title: 'Case Closed',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q24 case board', () => {
      it("quotes this player's findings with exactly one exhibit miscopied, for every participant", async () => {
        const kinds = new Set<string>();
        for (let roll = 25_115_000; roll < 25_115_116; roll++) {
          const { prompt } = (await getPublicChallengeData(ctx(roll), 24)).publicData as { prompt: string };
          const priv = (await generateChallengeForParticipant(ctx(roll), 24)).instance.privateData as Q24Private;
          const truths = [await answerOf(roll, 15), await answerOf(roll, 22), await answerOf(roll, 23)];
          const missing = truths.filter((t) => !prompt.includes(t));
          expect(missing).toEqual([priv.truth]);
          if (priv.altered === 'met') expect(prompt).toMatch(/met Vale on 2001-\d\d-\d\d/);
          kinds.add(priv.altered);
        }
        expect(kinds.size).toBe(3);
      });

      it('files only with the name and the true value', async () => {
        const c = ctx(25_115_012);
        const priv = (await generateChallengeForParticipant(c, 24)).instance.privateData as Q24Private;
        expect((await validateChallengeAnswer(c, 24, `daniel reyes / ${priv.truth.toLowerCase()}`)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 24, `Daniel Reyes, ${priv.truth}`)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 24, 'DANIEL REYES')).correct).toBe(false);
        expect((await validateChallengeAnswer(c, 24, `MIRA CASTELLAN / ${priv.truth}`)).correct).toBe(false);
      });
    });
  },
});
