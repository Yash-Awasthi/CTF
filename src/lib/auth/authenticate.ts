import type { AstroCookies } from 'astro';
import type { AnySQLiteDb } from '../db/client';
import { LOGIN_ALLOWED_STATES } from './constants';
import { readSessionCookie } from './cookies';
import { findValidSession } from './sessions';
import type { AuthContext, EventRow } from './types';

/** Phase 2 event-state login policy: READY / LIVE / FROZEN permit login. */
export function isLoginAllowed(state: EventRow['state']): boolean {
	return LOGIN_ALLOWED_STATES.includes(state);
}

/**
 * The single reusable auth resolver: cookie → hash → session → participant →
 * event → typed context, or null. Later phases (challenges, submissions, hints,
 * leaderboard) reuse this instead of duplicating auth queries.
 */
export async function getAuthenticatedParticipant(
	cookies: AstroCookies,
	db: AnySQLiteDb,
	now?: Date,
): Promise<AuthContext | null> {
	const rawToken = readSessionCookie(cookies);
	return findValidSession(db, rawToken, now);
}
