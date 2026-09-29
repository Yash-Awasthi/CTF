import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import q18, { CARRIER, type Q18Private } from '../../challenges/18/index';
import { RATE } from '../../challenges/shared/audio';

const CODE: Record<string, string> = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y', '--..': 'Z',
};

/** Decode Morse from the WAV the way a player would: 1 kHz energy per 10 ms, then run lengths. */
function decode(bytes: Uint8Array, freq: number, threshold: number, win = RATE / 100): string {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  const n = (bytes.length - 44) / 2;

  const on: boolean[] = [];
  const k = (2 * Math.PI * freq) / RATE;
  for (let s = 0; s + win <= n; s += win) {
    let re = 0, im = 0;
    for (let i = 0; i < win; i++) { const x = v.getInt16(44 + (s + i) * 2, true) / 32767; re += x * Math.cos(k * i); im += x * Math.sin(k * i); }
    on.push(Math.hypot(re, im) / win > threshold);
  }
  const runs: [boolean, number][] = [];
  for (const b of on) runs.length && runs[runs.length - 1][0] === b ? runs[runs.length - 1][1]++ : runs.push([b, 1]);
  const unit = Math.min(...runs.filter(([b]) => b).map(([, l]) => l));
  let out = '', sym = '';
  for (const [b, l] of runs) {
    if (b) sym += l > 2 * unit ? '-' : '.';
    else if (l > 2 * unit && sym) { out += CODE[sym] ?? '?'; sym = ''; if (l > 5 * unit) out += ' '; }
  }
  return (out + (CODE[sym] ?? '')).trim();
}

defineChallengeTests({
  slot: 18,
  key: 'for-you',
  title: 'For You',
  tier: 'medium',
  basePoints: 200,
  attributionEnabled: false,
  customTests: () => {
    describe('Q18 voicemail audio', () => {
      it('decodes from the audio alone to the answer, and the carrier spells TC', async () => {
        for (const roll of [25_115_000, 25_115_041, 25_115_099]) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 18);
          const priv = instance.privateData as Q18Private;
          const file = (await q18.artifact!(instance as any, 'voicemail.wav'))!;
          expect(file.contentType).toBe('audio/wav');
          expect(decode(file.body as Uint8Array, 1000, 0.08)).toBe(priv.answer);
          expect(decode(file.body as Uint8Array, 440, 0.015, RATE / 25).replace(/\s/g, '')).toContain(CARRIER.replace(' ', ''));
          const owner = ((await generateChallengeForParticipant(ctx(roll), 11)).instance.privateData as { answer: string }).answer;
          expect(priv.answer).toContain(owner.split(' ').pop()!);
          expect(JSON.stringify(instance.publicData).toUpperCase()).not.toContain(priv.answer);
        }
      });

      it('accepts the phrase with collapsed or missing spaces', async () => {
        const c = ctx(25_115_007);
        const { instance } = await generateChallengeForParticipant(c, 18);
        const a = (instance.privateData as Q18Private).answer;
        expect((await validateChallengeAnswer(c, 18, a.toLowerCase())).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 18, a.replace(/ /g, '  '))).correct).toBe(true);
        expect((await validateChallengeAnswer(c, 18, a.replace(/ /g, ''))).correct).toBe(true);
      });
    });
  },
});
