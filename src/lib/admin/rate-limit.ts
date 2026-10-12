/**
 * Admin-login failure audit. Global (non-event-scoped), keyed by
 * HMAC(ip, RATE_LIMIT_SECRET) — raw IPs never persisted. Throttling itself is the
 * ADMIN_LOGIN_LIMITER binding; this table only counts failures per window.
 */
import { eq } from 'drizzle-orm';
import type { DB } from '../db/client';
import { adminLoginRateLimit } from '../db/schema';
import { FAILURE_AUDIT_WINDOW_SECONDS } from '../auth/constants';

export { hashIp } from '../auth/rate-limit';

function windowExpired(windowStart: Date, now: Date): boolean {
	return (now.getTime() - windowStart.getTime()) / 1000 >= FAILURE_AUDIT_WINDOW_SECONDS;
}

/** Audit one failed admin login (starts a new window if the prior one lapsed). */
export async function recordAdminFailure(
	db: DB,
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
