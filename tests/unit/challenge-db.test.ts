import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { challenges } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import {
	syncChallengeRows,
	validateChallengeConsistency,
	getChallengeRowId,
} from '../../src/lib/challenges/sync';
import { getEventRoster } from '../../src/lib/challenges/roster';
import { RegistryDbMismatchError } from '../../src/lib/challenges/errors';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
	.join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let eventId: number;

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	eventId = res.eventId;
});

describe('challenge row sync ↔ registry', () => {
	it('syncs exactly 30 rows and passes consistency', async () => {
		await syncChallengeRows(db, eventId);
		const rows = await db.select().from(challenges).where(eq(challenges.eventId, eventId));
		expect(rows).toHaveLength(30);
		await expect(validateChallengeConsistency(db, eventId)).resolves.toBeUndefined();
	});

	it('sync is idempotent (safe to re-run)', async () => {
		await syncChallengeRows(db, eventId);
		await syncChallengeRows(db, eventId);
		const rows = await db.select().from(challenges).where(eq(challenges.eventId, eventId));
		expect(rows).toHaveLength(30);
	});

	it('missing rows fail consistency', async () => {
		await expect(validateChallengeConsistency(db, eventId)).rejects.toThrow(
			RegistryDbMismatchError,
		);
	});

	it('metadata mismatch fails consistency', async () => {
		await syncChallengeRows(db, eventId);
		await db
			.update(challenges)
			.set({ basePoints: 99999 })
			.where(eq(challenges.eventId, eventId));
		await expect(validateChallengeConsistency(db, eventId)).rejects.toThrow(
			RegistryDbMismatchError,
		);
	});

	it('resolves the FK row id by (event, slot)', async () => {
		await syncChallengeRows(db, eventId);
		const id = await getChallengeRowId(db, eventId, 8);
		expect(typeof id).toBe('number');
	});
});

describe('roster ordering', () => {
	it('returns 116 rolls in ascending order', async () => {
		const roster = await getEventRoster(db, eventId);
		expect(roster).toHaveLength(116);
		expect(roster[0]).toBe(25_115_000);
		expect(roster[115]).toBe(25_115_115);
		const sorted = [...roster].sort((a, b) => a - b);
		expect(roster).toEqual(sorted);
	});
});
