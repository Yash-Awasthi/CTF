import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData } from '../../src/lib/challenges/engine';

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
      it("quotes this player's own findings from Q15, Q22 and Q23", async () => {
        for (const roll of [25_115_000, 25_115_077]) {
          const { prompt } = (await getPublicChallengeData(ctx(roll), 24)).publicData as { prompt: string };
          for (const slot of [15, 22, 23]) expect(prompt).toContain(await answerOf(roll, slot));
        }
      });
    });
  },
});
