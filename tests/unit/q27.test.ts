import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, getPublicChallengeData, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import { NOISE, SYMBOLS, VISIBLE, hiddenText, type Q27Private } from '../../challenges/27/index';

/** Solve as a player: drop visible text and noise, try all 24 digit assignments. */
function reveal(line: string): string[] {
  const run = [...line].filter((c) => SYMBOLS.includes(c));
  const perms = (a: string[]): string[][] => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const out: string[] = [];
  for (const digits of perms(SYMBOLS)) {
    let s = '';
    for (let i = 0; i < run.length; i += 4) s += String.fromCharCode(run.slice(i, i + 4).reduce((b, c) => b * 4 + digits.indexOf(c), 0));
    if (/^[\x20-\x7e]+$/.test(s)) out.push(s);
  }
  return out;
}

defineChallengeTests({
  slot: 27,
  key: 'stop-looking-for-people',
  title: 'Stop Looking for People',
  tier: 'hard',
  basePoints: 450,
  attributionEnabled: true,
  customTests: () => {
    describe('Q27 zero-width line', () => {
      it('threads one printable reading through the visible sentence, for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { instance } = await generateChallengeForParticipant(c, 27);
          const folio = (instance.privateData as Q27Private).answer;
          const { prompt } = (await getPublicChallengeData(c, 27)).publicData as { prompt: string };
          const line = prompt.split('\n').find((l) => l.includes('\u200b') || l.includes('\u2060'))!;
          expect([...line].filter((ch) => !SYMBOLS.includes(ch) && ch !== NOISE).join('')).toBe(VISIBLE);
          expect(line).toContain(NOISE);
          expect(reveal(line).filter((s) => /^[A-Za-z0-9 .]+$/.test(s))).toEqual([hiddenText(folio)]);
          expect(prompt.toLowerCase()).not.toContain('follow');
          expect(prompt).not.toContain(folio);
        }
      });

      it('accepts the folio with or without its label', async () => {
        const c = ctx(25_115_020);
        const { instance } = await generateChallengeForParticipant(c, 27);
        const folio = (instance.privateData as Q27Private).answer;
        expect((await validateChallengeAnswer(c, 27, folio)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 27, `Ledger folio ${folio}.`)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 27, 'Follow the names.')).correct).toBe(false);
      });
    });
  },
});
