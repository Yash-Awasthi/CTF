import { drizzle } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { schema } from './schema';

/**
 * Common base of both the D1 (async) runtime client and the better-sqlite3
 * (sync) test client. Auth/db helpers accept this so they run identically in
 * Workers and in Vitest. Callers `await` results — sync results await fine.
 */
export type AnySQLiteDb = BaseSQLiteDatabase<'async' | 'sync', unknown>;

/**
 * Build a Drizzle client bound to the request's D1 database.
 * Call with the Cloudflare runtime binding: `createDb(env.DB)`.
 */
export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDb>;
