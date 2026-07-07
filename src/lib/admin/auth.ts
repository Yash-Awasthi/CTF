/**
 * Admin authentication (Phase 12.5 hardened). A single shared `ADMIN_SECRET`
 * (env, server-only) is the login CREDENTIAL; on success we mint an OPAQUE admin
 * session — the same security model as participant sessions:
 *  - 256-bit CSPRNG raw token, sent ONLY in the HttpOnly admin cookie.
 *  - D1 stores only SHA-256(token); the raw token is never persisted or logged.
 *  - Explicit created_at / expires_at; expired or revoked sessions are rejected.
 *  - Logout revokes the current session.
 * Admin sessions live in their OWN table, so a participant session can never
 * authenticate as admin and vice-versa. ADMIN_SECRET never enters D1 or a client
 * bundle; the password compare is constant-time.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import type { AnySQLiteDb } from '../db/client';
import { adminSessions } from '../db/schema';
import { generateSessionToken, hashSessionToken } from '../auth/session-token';

export const ADMIN_COOKIE = 'admin_session';
const ADMIN_TTL_SECONDS = 12 * 60 * 60; // 12h admin session (explicit, bounded).

interface AdminEnv {
	ADMIN_SECRET: string;
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Validate the admin login password (== ADMIN_SECRET), constant-time. */
export function verifyAdminPassword(env: AdminEnv, password: string): boolean {
	if (!env.ADMIN_SECRET) return false;
	return timingSafeEqual(password, env.ADMIN_SECRET);
}

/** Mint a new opaque admin session. Returns the RAW token (hash-only in D1). */
export async function createAdminSession(
	db: AnySQLiteDb,
	now: Date = new Date(),
): Promise<{ rawToken: string; expiresAt: Date }> {
	const rawToken = generateSessionToken(); // 256-bit CSPRNG, base64url
	const tokenHash = await hashSessionToken(rawToken);
	const expiresAt = new Date(now.getTime() + ADMIN_TTL_SECONDS * 1000);
	await db.insert(adminSessions).values({ tokenHash, expiresAt });
	return { rawToken, expiresAt };
}

/** True iff the raw token maps to a live (non-revoked, non-expired) session. */
export async function isValidAdminSession(
	db: AnySQLiteDb,
	rawToken: string | undefined,
	now: Date = new Date(),
): Promise<boolean> {
	if (!rawToken) return false;
	const tokenHash = await hashSessionToken(rawToken);
	const row = await db
		.select({ expiresAt: adminSessions.expiresAt })
		.from(adminSessions)
		.where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt)))
		.get();
	if (!row) return false;
	return row.expiresAt.getTime() > now.getTime();
}

/** Revoke the session for a raw token (idempotent). Used by logout/reset. */
export async function revokeAdminSession(
	db: AnySQLiteDb,
	rawToken: string | undefined,
	now: Date = new Date(),
): Promise<void> {
	if (!rawToken) return;
	const tokenHash = await hashSessionToken(rawToken);
	await db
		.update(adminSessions)
		.set({ revokedAt: now })
		.where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt)));
}

/** Cookie helpers. */
export function setAdminCookie(cookies: AstroCookies, rawToken: string): void {
	cookies.set(ADMIN_COOKIE, rawToken, {
		httpOnly: true,
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		path: '/',
		maxAge: ADMIN_TTL_SECONDS,
	});
}
export function clearAdminCookie(cookies: AstroCookies): void {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}
export function readAdminCookie(cookies: AstroCookies): string | undefined {
	return cookies.get(ADMIN_COOKIE)?.value;
}

/** True iff the request carries a valid admin session cookie. */
export async function isAdmin(cookies: AstroCookies, db: AnySQLiteDb): Promise<boolean> {
	return isValidAdminSession(db, readAdminCookie(cookies));
}

/**
 * Same-origin guard for cookie-authenticated mutations (CSRF defence). Accepts
 * requests whose Origin (or Referer) host matches the request host.
 */
export function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	const host = request.headers.get('host');
	if (!origin) {
		const referer = request.headers.get('referer');
		if (!referer) return true; // non-browser/native call; cookie+HttpOnly still required
		try {
			return new URL(referer).host === host;
		} catch {
			return false;
		}
	}
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}
