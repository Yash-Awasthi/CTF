/**
 * Admin-login brute-force throttle. Global (non-event-scoped), keyed by
 * HMAC(ip, RATE_LIMIT_SECRET) — raw IPs never persisted. Reuses the Phase 2
 * policy constants + `hashIp`; a dedicated tiny table is used only because the
 * participant `login_rate_limit` is event-scoped and admin login is not.
 */
import { eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { adminLoginRateLimit } from '../db/schema';
import { RATE_LIMIT_MAX_FAILURES, RATE_LIMIT_WINDOW_SECONDS } from '../auth/constants';

export { hashIp } from '../auth/rate-limit';

function windowExpired(windowStart: Date, now: Date): boolean {
	return (now.getTime() - windowStart.getTime()) / 1000 >= RATE_LIMIT_WINDOW_SECONDS;
}

/** Is this IP currently in admin-login cooldown? */
export async function checkAdminRateLimit(
	db: AnySQLiteDb,
	ipHash: string,
	now: Date = new Date(),
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
	const row = await db
		.select()
		.from(adminLoginRateLimit)
		.where(eq(adminLoginRateLimit.ipHash, ipHash))
		.get();
	if (!row || windowExpired(row.windowStart, now)) return { blocked: false, retryAfterSeconds: 0 };
	const elapsed = (now.getTime() - row.windowStart.getTime()) / 1000;
	return {
		blocked: row.failureCount >= RATE_LIMIT_MAX_FAILURES,
		retryAfterSeconds: Math.max(0, Math.ceil(RATE_LIMIT_WINDOW_SECONDS - elapsed)),
	};
}

/** Record one failed admin login (resets the window if it lapsed). */
export async function recordAdminFailure(
	db: AnySQLiteDb,
	ipHash: string,
	now: Date = new Date(),
): Promise<void> {
	const row = await db
		.select()
		.from(adminLoginRateLimit)
		.where(eq(adminLoginRateLimit.ipHash, ipHash))
		.get();
	if (!row) {
		await db.insert(adminLoginRateLimit).values({ ipHash, windowStart: now, failureCount: 1 });
		return;
	}
	if (windowExpired(row.windowStart, now)) {
		await db.update(adminLoginRateLimit).set({ windowStart: now, failureCount: 1 }).where(eq(adminLoginRateLimit.id, row.id));
	} else {
		await db.update(adminLoginRateLimit).set({ failureCount: row.failureCount + 1 }).where(eq(adminLoginRateLimit.id, row.id));
	}
}

/** Clear failed-attempt state for an IP (on successful login). */
export async function resetAdminFailures(db: AnySQLiteDb, ipHash: string): Promise<void> {
	await db.delete(adminLoginRateLimit).where(eq(adminLoginRateLimit.ipHash, ipHash));
}
