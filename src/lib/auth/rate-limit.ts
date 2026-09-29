import { and, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { loginRateLimit, type RATE_LIMIT_SCOPES } from '../db/schema';
import {
	RATE_LIMIT_MAX_FAILURES,
	RATE_LIMIT_WINDOW_SECONDS,
} from './constants';

type Scope = (typeof RATE_LIMIT_SCOPES)[number];

interface ScopeKey {
	eventId: number;
	scope: Scope;
	subject: string;
}

/** Throttle policy. Defaults preserve the login policy for existing callers. */
export interface RateLimitPolicy {
	maxFailures: number;
	windowSeconds: number;
}

const LOGIN_POLICY: RateLimitPolicy = {
	maxFailures: RATE_LIMIT_MAX_FAILURES,
	windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
};

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

export interface RateLimitStatus {
	blocked: boolean;
	retryAfterSeconds: number;
}

function windowExpired(windowStart: Date, now: Date, windowSeconds: number): boolean {
	return (now.getTime() - windowStart.getTime()) / 1000 >= windowSeconds;
}

/** Read-only check: is this scope currently in cooldown? */
export async function checkRateLimit(
	db: AnySQLiteDb,
	key: ScopeKey,
	now: Date = new Date(),
	policy: RateLimitPolicy = LOGIN_POLICY,
): Promise<RateLimitStatus> {
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

	if (!row || windowExpired(row.windowStart, now, policy.windowSeconds)) {
		return { blocked: false, retryAfterSeconds: 0 };
	}
	const elapsed = (now.getTime() - row.windowStart.getTime()) / 1000;
	return {
		blocked: row.failureCount >= policy.maxFailures,
		retryAfterSeconds: Math.max(0, Math.ceil(policy.windowSeconds - elapsed)),
	};
}

/** Record one failed attempt; resets the window if the prior one lapsed. */
export async function recordFailure(
	db: AnySQLiteDb,
	key: ScopeKey,
	now: Date = new Date(),
	policy: RateLimitPolicy = LOGIN_POLICY,
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

	if (windowExpired(row.windowStart, now, policy.windowSeconds)) {
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

/** Clear failed-attempt state for a scope (called on successful login). */
export async function resetFailures(
	db: AnySQLiteDb,
	key: ScopeKey,
): Promise<void> {
	await db
		.delete(loginRateLimit)
		.where(
			and(
				eq(loginRateLimit.eventId, key.eventId),
				eq(loginRateLimit.scope, key.scope),
				eq(loginRateLimit.subject, key.subject),
			),
		);
}
