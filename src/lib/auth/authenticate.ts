import type { AstroCookies } from 'astro';
import type { AnySQLiteDb } from '../db/client';
import { canParticipantLogin } from '../event/access';
import { readSessionCookie } from './cookies';
import { findValidSession } from './sessions';
import type { AuthContext, EventRow } from './types';

/**
 * Event-state login policy (READY / LIVE / FROZEN). Delegates to the centralized
 * event access policy so the rule lives in exactly one place.
 */
export function isLoginAllowed(state: EventRow['state']): boolean {
	return canParticipantLogin(state);
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
