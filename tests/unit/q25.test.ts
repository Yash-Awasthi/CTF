import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant } from '../../src/lib/challenges/engine';
import q25, { FILE, issueOf, type Q25Private } from '../../challenges/25/index';

/** Parse PNG chunks: returns tEXt and zTXt metadata and the decoded raw length. */
function readPng(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  const text: Record<string, string> = {};
  const ztext: Record<string, string> = {};
  const idat: Uint8Array[] = [];
  let w = 0, h = 0;
  for (let o = 8; o < bytes.length;) {
    const len = v.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = v.getUint32(o + 8); h = v.getUint32(o + 12); }
    if (type === 'tEXt') { const s = String.fromCharCode(...data); const z = s.indexOf('\0'); text[s.slice(0, z)] = s.slice(z + 1); }
    if (type === 'zTXt') { const z = data.indexOf(0); ztext[String.fromCharCode(...data.subarray(0, z))] = inflateSync(data.subarray(z + 2)).toString('latin1'); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { w, h, text, ztext, rawLength: raw.length };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Date (YYYY-MM-DD) carrying a given issue number, or null. */
function dateOfIssue(issue: number): string | null {
  for (let n = issue; n < issue * 2; n++) {
    if (n - Math.floor(n / 7) !== issue || n % 7 === 0) continue;
    return new Date(Date.UTC(1870, 0, 3) + (n - 1) * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

defineChallengeTests({
  slot: 25,
  key: 'three-sources',
  title: 'Three Sources',
  tier: 'hard',
  basePoints: 350,
  attributionEnabled: false,
  customTests: () => {
    describe('Q25 photograph', () => {
      it('issue numbering skips Sundays from 3 January 1870', () => {
        expect(issueOf('1870-01-03')).toBe(1);
        expect(issueOf('1870-01-08')).toBe(6);
        expect(issueOf('1870-01-10')).toBe(7);
        expect(dateOfIssue(7)).toBe('1870-01-10');
      });

      it('hides the sleeve in zTXt and solves to one date with the hundreds digit unknown', async () => {
        for (let roll = 25_115_000; roll < 25_115_116; roll++) {
          const { instance } = await generateChallengeForParticipant(ctx(roll), 25);
          const priv = instance.privateData as Q25Private;
          const file = (await q25.artifact!(instance as any, FILE))!;
          const bytes = file.body as Uint8Array;
          const { w, h, text, ztext, rawLength } = readPng(bytes);
          expect([w, h, rawLength]).toEqual([480, 320, 320 * 481]);
          expect(text.Comment).toBeUndefined();
          expect(Buffer.from(bytes).toString('latin1')).not.toContain('developed');
          const [y, m] = priv.answer.split('-');
          expect(ztext.Comment).toContain(`developed ${MONTHS[Number(m) - 1]} ${y}`);
          expect(text.Description).toContain('1958-1971');
          expect(Number(y)).toBeGreaterThanOrEqual(1968);
          expect(Number(y)).toBeLessThanOrEqual(1971);
          expect(JSON.stringify(instance.publicData)).not.toContain(y);

          // Solve as a player: every digit under the thumb, keep dates in the sleeve's month.
          const issue = issueOf(priv.answer);
          const hundreds = Math.floor(issue / 100) % 10;
          const fits = Array.from({ length: 10 }, (_, k) => dateOfIssue(issue + (k - hundreds) * 100))
            .filter((d): d is string => !!d && d.startsWith(`${y}-${m}`));
          expect(fits).toEqual([priv.answer]);
        }
      });
    });
  },
});
