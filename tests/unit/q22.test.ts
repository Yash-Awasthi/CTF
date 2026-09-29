import { describe, expect, it } from 'vitest';
import { defineChallengeTests, ctx } from './helpers/challenge-factory';
import { generateChallengeForParticipant, validateChallengeAnswer } from '../../src/lib/challenges/engine';
import q22 from '../../challenges/22/index';

const rows = (csv: string) => csv.trim().split('\n').slice(1).map((l) => (l.match(/"[^"]*"|[^,]+/g) ?? []).map((v) => v.replace(/^"|"$/g, '')));

/** Solve the way a player would, from the two CSV files only. */
async function solve(instance: any): Promise<string> {
  const register = rows(String((await q22.artifact!(instance, 'card-register.csv'))!.body));
  const log = rows(String((await q22.artifact!(instance, 'access-log.csv'))!.body));
  const card = register.find(([, holder, note]) => holder.startsWith('REYES, D.') && !/lost|suspend/i.test(note))![0];
  const write = '2015-10-03 02:41:00';
  const inside = log.filter(([ts, c, door, res]) => c === card && door !== 'MAIN ENTRANCE' && res === 'IN' && ts < write);
  const door = inside[inside.length - 1][2];
  expect(log.some(([ts, c, d, res]) => c === card && d === door && res === 'OUT' && ts > write)).toBe(true);
  return door;
}

defineChallengeTests({
  slot: 22,
  key: 'the-alibi',
  title: 'The Alibi',
  tier: 'hard',
  basePoints: 300,
  attributionEnabled: false,
  customTests: () => {
    describe('Q22 access logs', () => {
      it('the card register and door log lead to the answer room, for every participant', async () => {
        for (let i = 0; i < 116; i++) {
          const c = ctx(25_115_000 + i);
          const { instance } = await generateChallengeForParticipant(c, 22);
          const room = await solve(instance);
          expect((await validateChallengeAnswer(c, 22, room.toLowerCase())).correct).toBe(true);
          expect(JSON.stringify(instance.publicData)).not.toContain(room);
        }
      });
    });
  },
});
