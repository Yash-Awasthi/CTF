import type { EventRow } from '../auth/types';
import { ENDED_STATES } from './constants';
import type { EventTiming } from './types';

/**
 * Single source of derived event timing. Server time is authoritative; the
 * browser only renders these values. Canonical model: endsAt = startedAt +
 * durationSeconds (no independent ends_at field).
 */
export function getEventTiming(event: EventRow, now: Date = new Date()): EventTiming {
	const serverNow = Math.floor(now.getTime() / 1000);
	const startedAt = event.startedAt
		? Math.floor(event.startedAt.getTime() / 1000)
		: null;
	const hasStarted = startedAt !== null;
	const endsAt = hasStarted ? startedAt + event.durationSeconds : null;

	const elapsedSeconds = hasStarted ? Math.max(0, serverNow - startedAt) : 0;
	// Before start there is no active countdown → report the full configured duration.
	const remainingSeconds =
		endsAt !== null ? Math.max(0, endsAt - serverNow) : event.durationSeconds;

	const timeExpired = endsAt !== null && serverNow >= endsAt;
	const hasEnded =
		ENDED_STATES.has(event.state) || (event.state === 'LIVE' && timeExpired);
	const isLive = event.state === 'LIVE' && !timeExpired;

	return {
		state: event.state,
		serverNow,
		startedAt,
		endsAt,
		durationSeconds: event.durationSeconds,
		remainingSeconds,
		elapsedSeconds,
		hasStarted,
		hasEnded,
		isLive,
	};
}
