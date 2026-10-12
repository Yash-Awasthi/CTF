import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { createDb, type DB } from '../../src/lib/db/client';

export type Db = DB;

/** Empty local D1 with every migration applied. */
export async function freshDb(): Promise<Db> {
	// reset() also drops the migrations table, so each test re-applies the full schema.
	await reset();
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	return createDb(env.DB);
}
