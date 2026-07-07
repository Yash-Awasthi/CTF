import type { EventRow } from '../auth/types';
import { LOGIN_ALLOWED_STATES, type EventState } from './constants';
import { getEventTiming } from './timer';

/**
 * Centralized event access policies. Routes/pages consume these instead of
 * scattering raw state checks. Timing-dependent policies use authoritative
 * server time, not the persisted state alone (an expired LIVE event is not
 * accessible even before its lazy freeze lands).
 */
export function canParticipantLogin(state: EventState): boolean {
	return LOGIN_ALLOWED_STATES.includes(state);
}

export function canAccessWaitingRoom(state: EventState): boolean {
	return state === 'READY';
}

export function canAccessCompetition(event: EventRow, now: Date = new Date()): boolean {
	return getEventTiming(event, now).isLive;
}

export function canSubmit(event: EventRow, now: Date = new Date()): boolean {
	return getEventTiming(event, now).isLive;
}

export function canViewFinalResults(state: EventState): boolean {
	return state === 'RESULTS_PUBLISHED';
}
