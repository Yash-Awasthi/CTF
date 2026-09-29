/**
 * Guard for static evidence routes (/case/*). A participant may open an
 * artifact only once its challenge is unlocked, so URLs cannot be used to skip
 * ahead. Returns a Response to send, or null when access is allowed.
 */
import { createDb } from '../db/client';
import { getEnv } from '../runtime';
import { ensureCurrentEventState } from '../event/state';
import { canAccessCompetition } from '../event/access';
import { canAccessChallenge } from './access';
import type { AuthContext } from '../auth/types';

export async function gateArtifact(auth: AuthContext | null, slot: number): Promise<Response | null> {
	if (!auth) return new Response('Authentication required.', { status: 401 });
	const now = new Date();
	const event = await ensureCurrentEventState(createDb(getEnv().DB), auth.event, now);
	if (!canAccessCompetition(event, now)) return new Response('Event not live.', { status: 403 });
	if (!canAccessChallenge(auth.participant, slot)) {
		return new Response('Access denied — case file not yet unlocked.', { status: 403 });
	}
	return null;
}
