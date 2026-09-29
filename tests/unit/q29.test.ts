import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { DOCTRINE, isDoctrine } from '../../challenges/29/index';
import { NOISE } from '../../challenges/14/index';
import { CARRIER } from '../../challenges/18/index';
import { MARGIN } from '../../challenges/20/index';
import { HIDDEN } from '../../challenges/27/index';

defineChallengeTests({
  slot: 29,
  key: 'the-continuity',
  title: 'Anomaly Synthesis',
  tier: 'hard',
  basePoints: 350,
  attributionEnabled: false,
  customTests: () => {
    describe('Q29 meta', () => {
      it('the four feeder fragments fill the burned nouns of the Ledger note', async () => {
        const q28 = ((await getPublicChallengeData(ctx(25_115_000), 28)).publicData as { prompt: string }).prompt;
        expect(q28).toContain('█████ CHANGE. █████ REMAIN. █████ CHANGE. █████ REMAIN.');
        const nouns = [MARGIN, CARRIER.split(' ')[0], NOISE, HIDDEN.match(/Roles/i)![0].toUpperCase()];
        expect(nouns.sort()).toEqual(DOCTRINE.slice(0, 4).map((l) => l.split(' ')[0]).sort());
      });

      it('verifies the doctrine in any order and punctuation', () => {
        expect(isDoctrine('records change; people change. roles remain\nnames remain. The investigation must continue!')).toBe(true);
        expect(isDoctrine('PEOPLE CHANGE. NAMES REMAIN. RECORDS CHANGE. ROLES REMAIN.')).toBe(false);
        expect(isDoctrine('PEOPLE REMAIN. NAMES CHANGE. RECORDS CHANGE. ROLES REMAIN. THE INVESTIGATION MUST CONTINUE')).toBe(false);
      });

      it('points at the fragments without repeating them', async () => {
        const { instance } = await generateChallengeForParticipant(ctx(25_115_000), 29);
        const prompt = (instance.publicData as { prompt: string }).prompt;
        for (const word of ['RECORDS', 'NAMES REMAIN', 'PEOPLE', 'ROLES REMAIN', 'TC-', 'CONTINUITY']) expect(prompt).not.toContain(word);
        expect((await validateChallengeAnswer(ctx(25_115_000), 29, 'the continuity')).correct).toBe(true);
      });
    });
  },
});
