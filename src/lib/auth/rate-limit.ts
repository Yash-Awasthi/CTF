import { and, eq } from 'drizzle-orm';
import type { DB } from '../db/client';
import { loginRateLimit, type RATE_LIMIT_SCOPES } from '../db/schema';
import { FAILURE_AUDIT_WINDOW_SECONDS } from './constants';

type Scope = (typeof RATE_LIMIT_SCOPES)[number];

interface ScopeKey {
	eventId: number;
	scope: Scope;
	subject: string;
}

/**
 * Privacy-preserving IP identifier: HMAC-SHA256(ip, RATE_LIMIT_SECRET), hex.
 * Raw IPs are never persisted. Uses a dedicated secret, NOT EVENT_SECRET.
 */
export async function hashIp(ip: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sig = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(ip),
	);
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Spend one attempt from a Workers rate limiter; false once the key is over its limit. */
export async function allowAttempt(limiter: RateLimit, key: string): Promise<boolean> {
	return (await limiter.limit({ key })).success;
}

function windowExpired(windowStart: Date, now: Date): boolean {
	return (now.getTime() - windowStart.getTime()) / 1000 >= FAILURE_AUDIT_WINDOW_SECONDS;
}

/** Audit one failed attempt; starts a new window if the prior one lapsed. */
export async function recordFailure(
	db: DB,
	key: ScopeKey,
	now: Date = new Date(),
): Promise<void> {
	const row = await db
		.select()
		.from(loginRateLimit)
		.where(
			and(
				eq(loginRateLimit.eventId, key.eventId),
				eq(loginRateLimit.scope, key.scope),
				eq(loginRateLimit.subject, key.subject),
			),
		)
		.get();

	if (!row) {
		await db.insert(loginRateLimit).values({
			eventId: key.eventId,
			scope: key.scope,
			subject: key.subject,
			windowStart: now,
			failureCount: 1,
		});
		return;
	}

	if (windowExpired(row.windowStart, now)) {
		await db
			.update(loginRateLimit)
			.set({ windowStart: now, failureCount: 1 })
			.where(eq(loginRateLimit.id, row.id));
	} else {
		await db
			.update(loginRateLimit)
			.set({ failureCount: row.failureCount + 1 })
			.where(eq(loginRateLimit.id, row.id));
	}
}
