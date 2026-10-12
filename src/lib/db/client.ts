import { drizzle } from 'drizzle-orm/d1';

/**
 * Build a Drizzle client bound to the request's D1 database.
 * Call with the Cloudflare runtime binding: `createDb(env.DB)`.
 */
export function createDb(d1: D1Database) {
	return drizzle(d1);
}

export type DB = ReturnType<typeof createDb>;
