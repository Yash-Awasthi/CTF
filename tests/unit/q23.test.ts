import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import q23, { FILE, TEXT_START, type Q23Private } from '../../challenges/23/index';
import { RATE } from '../../challenges/shared/audio';
import { FONT } from '../../challenges/shared/font';

/** Read the painted text back: one 80 ms column at a time, seven row tones per column. */
function readSpectrum(bytes: Uint8Array, chars: number): string {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  const sample = (i: number) => v.getInt16(44 + i * 2, true) / 32767;
  const rows = Array.from({ length: 7 }, (_, y) => 3800 - (y * 800) / 6);
  const cols: number[][] = [];
  for (let c = 0; c < chars * 6; c++) {
    const s = Math.floor((TEXT_START + c * 0.08) * RATE) + 60, n = 400;
    cols.push(rows.map((f) => {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const x = sample(s + i); re += x * Math.cos((2 * Math.PI * f * (s + i)) / RATE); im += x * Math.sin((2 * Math.PI * f * (s + i)) / RATE); }
      return Math.hypot(re, im) / n > 0.012 ? 1 : 0;
    }));
  }
  let out = '';
  for (let ch = 0; ch < chars; ch++) {
    const glyph = Array.from({ length: 7 }, (_, y) => [0, 1, 2, 3, 4].reduce((acc, x) => acc | (cols[ch * 6 + x][y] << (4 - x)), 0));
    out += Object.entries(FONT).find(([, g]) => g.every((r, i) => r === glyph[i]))?.[0] ?? '?';
  }
  return out;
}

defineChallengeTests({
  slot: 23,
  key: 'miras-last-recording',
  title: "Mira's Last Recording",
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q23 recording', () => {
      it('carries the name and box number in the spectrum only', async () => {
        for (const roll of [25_115_000, 25_115_060, 25_115_111]) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 23);
          const priv = instance.privateData as Q23Private;
          const file = (await q23.artifact!(instance as any, FILE))!;
          const text = `DANIEL  BOX ${priv.answer}`;
          expect(readSpectrum(file.body as Uint8Array, text.length)).toBe(text);
          expect(JSON.stringify(instance.publicData)).not.toContain(priv.answer);
        }
      });

      it('accepts the bare number or the box label', async () => {
        const c = ctx(25_115_004);
        const { instance } = await generateChallengeForParticipant(c, 23);
        const a = (instance.privateData as Q23Private).answer;
        for (const guess of [a, `BOX ${a}`, `Daniel  box ${a}`]) expect((await validateChallengeAnswer(c, 23, guess)).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 23, 'DANIEL')).correct).toBe(false);
      });
    });
  },
});
