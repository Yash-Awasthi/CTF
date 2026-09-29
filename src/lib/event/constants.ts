import { EVENT_STATES } from '../db/schema';

export type EventState = (typeof EVENT_STATES)[number];

/** Maximum TOTAL event duration: 48 hours (not "6 additional hours"). */
export const MAX_EVENT_DURATION_SECONDS = 172_800;

/**
 * Forward-only lifecycle: each state has exactly one legal successor (or none).
 * Backward moves, skips, self-transitions, and mutations from ARCHIVED are all
 * rejected because they are never a value here.
 */
export const EVENT_TRANSITIONS: Record<EventState, EventState | null> = {
	DRAFT: 'READY',
	READY: 'LIVE',
	LIVE: 'FROZEN',
	FROZEN: 'REVIEW',
	REVIEW: 'RESULTS_PUBLISHED',
	RESULTS_PUBLISHED: 'ARCHIVED',
	ARCHIVED: null,
};

/** admin_actions.action_type values for event mutations. */
export const EVENT_ACTIONS = {
	markedReady: 'event_marked_ready',
	started: 'event_started',
	extended: 'event_extended',
	manualFreeze: 'event_manually_frozen',
	autoFreeze: 'event_automatically_frozen',
	reviewStarted: 'event_review_started',
	resultsPublished: 'event_results_published',
	archived: 'event_archived',
	durationChanged: 'event_duration_changed',
} as const;

/** Actor labels (Phase 3 has no admin identity yet). */
export const ACTOR_ADMIN = 'admin';
export const ACTOR_SYSTEM = 'system';

/** States in which a participant may log in (single source of truth). */
export const LOGIN_ALLOWED_STATES: readonly EventState[] = [
	'READY',
	'LIVE',
	'FROZEN',
];

/** States considered "ended" for timing derivation. */
export const ENDED_STATES: ReadonlySet<EventState> = new Set([
	'FROZEN',
	'REVIEW',
	'RESULTS_PUBLISHED',
	'ARCHIVED',
]);
