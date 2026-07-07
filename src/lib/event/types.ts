import type { EventState } from './constants';

/** Server-authoritative derived timing. All times are Unix SECONDS. */
export interface EventTiming {
	state: EventState;
	serverNow: number;
	startedAt: number | null;
	endsAt: number | null;
	durationSeconds: number;
	remainingSeconds: number;
	elapsedSeconds: number;
	hasStarted: boolean;
	hasEnded: boolean;
	isLive: boolean;
}
