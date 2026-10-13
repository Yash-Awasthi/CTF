import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { DOCTRINE, KEEPER, isDoctrine, vigenere, type Q29Private } from '../../challenges/29/index';
import { NOISE } from '../../challenges/14/index';
import { CARRIER } from '../../challenges/18/index';
import { MARGIN } from '../../challenges/20/index';
import { hiddenText } from '../../challenges/27/index';

defineChallengeTests({
  slot: 29,
  key: 'the-continuity',
  title: 'Anomaly Synthesis',
  tier: 'hard',
  basePoints: 550,
  attributionEnabled: true,
  customTests: () => {
    describe('Q29 meta', () => {
      it('the four feeder fragments fill the burned nouns of the Ledger note', async () => {
        const q28 = ((await getPublicChallengeData(ctx(25_115_000), 28)).publicData as { prompt: string }).prompt;
        expect(q28).toContain('█████ CHANGE. █████ REMAIN. █████ CHANGE. █████ REMAIN.');
        const nouns = [MARGIN, CARRIER.split(' ')[0], NOISE, hiddenText('0').match(/Roles/i)![0].toUpperCase()];
        expect(nouns.sort()).toEqual(DOCTRINE.slice(0, 4).map((l) => l.split(' ')[0]).sort());
      });

      it('verifies the doctrine in any order and punctuation', () => {
        expect(isDoctrine('records change; people change. roles remain\nnames remain. The investigation must continue!')).toBe(true);
        expect(isDoctrine('PEOPLE CHANGE. NAMES REMAIN. RECORDS CHANGE. ROLES REMAIN.')).toBe(false);
        expect(isDoctrine('PEOPLE REMAIN. NAMES CHANGE. RECORDS CHANGE. ROLES REMAIN. THE INVESTIGATION MUST CONTINUE')).toBe(false);
      });

      it('the countersign deciphers only under the keeper name, and is the answer', async () => {
        expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
        for (const roll of [25_115_000, 25_115_077]) {
          const c = ctx(roll);
          const { instance } = await generateChallengeForParticipant(c, 29);
          const answer = (instance.privateData as Q29Private).answer;
          const shown = vigenere(answer, KEEPER);
          expect(shown).not.toBe(answer);
          expect(vigenere(shown, 'THECONTINUITY', true)).toBe(answer);
          expect((await validateChallengeAnswer(c, 29, answer.toLowerCase().replace('-', ' '))).correct).toBe(true);
          expect((await validateChallengeAnswer(c, 29, shown)).correct).toBe(false);
          expect((await validateChallengeAnswer(c, 29, 'the continuity')).correct).toBe(false);
        }
      });

      it('points at the fragments without repeating them', async () => {
        const { instance } = await generateChallengeForParticipant(ctx(25_115_000), 29);
        const prompt = (instance.publicData as { prompt: string }).prompt;
        for (const word of ['RECORDS', 'NAMES REMAIN', 'PEOPLE', 'ROLES REMAIN', 'TC-', 'CONTINUITY']) expect(prompt).not.toContain(word);
        expect(prompt).not.toContain((instance.privateData as Q29Private).answer);
      });
    });
  },
});
