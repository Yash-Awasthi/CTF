import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant } from '../../src/lib/challenges/engine';
import q25, { FILE, type Q25Private } from '../../challenges/25/index';

/** Parse PNG chunks: returns text metadata and the decoded grayscale rows. */
function readPng(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  const text: Record<string, string> = {};
  const idat: Uint8Array[] = [];
  let w = 0, h = 0;
  for (let o = 8; o < bytes.length;) {
    const len = v.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = v.getUint32(o + 8); h = v.getUint32(o + 12); }
    if (type === 'tEXt') { const s = String.fromCharCode(...data); const z = s.indexOf('\0'); text[s.slice(0, z)] = s.slice(z + 1); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { w, h, text, rawLength: raw.length };
}

defineChallengeTests({
  slot: 25,
  key: 'three-sources',
  title: 'Three Sources',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q25 photograph', () => {
      it('is a valid PNG whose metadata agrees with the answer month and year', async () => {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        for (const roll of [25_115_000, 25_115_033, 25_115_090]) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 25);
          const priv = instance.privateData as Q25Private;
          const file = (await q25.artifact!(instance as any, FILE))!;
          const { w, h, text, rawLength } = readPng(file.body as Uint8Array);
          expect([w, h, rawLength]).toEqual([480, 320, 320 * 481]);
          const [y, m] = priv.answer.split('-');
          expect(text.Comment).toContain(`${months[Number(m) - 1]} ${y}`);
          expect(text.Description).toContain('1958-1971');
          expect(Number(y)).toBeGreaterThanOrEqual(1968);
          expect(Number(y)).toBeLessThanOrEqual(1975);
          expect(JSON.stringify(text)).not.toContain(priv.answer);
          expect(JSON.stringify(instance.publicData)).not.toContain(y);
        }
      });
    });
  },
});
