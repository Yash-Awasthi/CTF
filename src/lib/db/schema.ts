/**
 * case-files CTF — Drizzle schema (source of truth for all 12 tables).
 *
 * Multi-event by design: every event-scoped row keys on `event_id`. Surrogate
 * integer `id` columns are the primary keys and FK targets everywhere; the roll
 * number is a participant's login identity WITHIN an event, never a global key.
 *
 * Conventions:
 * - Timestamps: integer Unix epoch SECONDS (`{ mode: 'timestamp' }`), default
 *   `unixepoch()`. Consistent across every table.
 * - Scores & factors: integers only, never floats (see Score precision note in
 *   ctf-build-plan.md). `score`/`final_score` are milli-points (1 pt = 1000).
 *   `time_factor`/`hint_factor` are per-mille integers (e.g. 0.5 → 500).
 * - Deletion: events cascade to all children; participants cascade to their
 *   sessions/submissions/solves/hint_usage. Requires `PRAGMA foreign_keys=ON`.
 */
import { sql } from 'drizzle-orm';
import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
	index,
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
	integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`);

/** Event lifecycle states (§23 of the build spec). */
export const EVENT_STATES = [
	'DRAFT',
	'READY',
	'LIVE',
	'FROZEN',
	'REVIEW',
	'RESULTS_PUBLISHED',
	'ARCHIVED',
] as const;

export const PARTICIPANT_STATUSES = [
	'registered',
	'active',
	'disqualified',
] as const;

export const CHALLENGE_TIERS = ['easy', 'medium', 'hard', 'capstone'] as const;

// ── events ──────────────────────────────────────────────────────────────────
export const events = sqliteTable('events', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	state: text('state', { enum: EVENT_STATES }).notNull().default('DRAFT'),
	// null until the admin starts the event (server-authoritative clock).
	startedAt: integer('started_at', { mode: 'timestamp' }),
	durationSeconds: integer('duration_seconds').notNull().default(0),
	// Version REFERENCE for the personalization secret. The real EVENT_SECRET is
	// never stored in the DB — it comes from the runtime env. Frozen once LIVE.
	secretVersion: text('secret_version').notNull().default('v1'),
	createdAt: createdAt(),
});

// ── participants ────────────────────────────────────────────────────────────
export const participants = sqliteTable(
	'participants',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		rollNumber: integer('roll_number').notNull(),
		currentChallenge: integer('current_challenge').notNull().default(1),
		// milli-points; participant total = sum of solves.final_score.
		score: integer('score').notNull().default(0),
		status: text('status', { enum: PARTICIPANT_STATUSES })
			.notNull()
			.default('registered'),
		createdAt: createdAt(),
		lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
	},
	(t) => [
		// Enforces "one participant per roll number per event" AND serves as the
		// login lookup index (event_id + roll_number).
		uniqueIndex('participants_event_roll_unq').on(t.eventId, t.rollNumber),
	],
);

// ── sessions ────────────────────────────────────────────────────────────────
export const sessions = sqliteTable(
	'sessions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		participantId: integer('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		createdAt: createdAt(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
	},
	(t) => [
		index('sessions_participant_idx').on(t.participantId),
		index('sessions_event_idx').on(t.eventId),
		// One active (non-revoked) session per participant, enforced at the DB
		// level. A concurrent second login cannot leave two live sessions.
		uniqueIndex('sessions_one_active_per_participant')
			.on(t.participantId)
			.where(sql`revoked_at IS NULL`),
	],
);

// ── challenges ──────────────────────────────────────────────────────────────
export const challenges = sqliteTable(
	'challenges',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		slot: integer('slot').notNull(), // 1..30
		tier: text('tier', { enum: CHALLENGE_TIERS }).notNull(),
		basePoints: integer('base_points').notNull(),
		attributionEnabled: integer('attribution_enabled', { mode: 'boolean' })
			.notNull()
			.default(false),
		prerequisites: text('prerequisites'), // JSON array of slot numbers, nullable
		createdAt: createdAt(),
	},
	(t) => [uniqueIndex('challenges_event_slot_unq').on(t.eventId, t.slot)],
);

// ── submissions (every attempt, correct or not) ─────────────────────────────
export const submissions = sqliteTable(
	'submissions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		participantId: integer('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		challengeId: integer('challenge_id')
			.notNull()
			.references(() => challenges.id, { onDelete: 'cascade' }),
		submittedAnswer: text('submitted_answer').notNull(),
		isCorrect: integer('is_correct', { mode: 'boolean' })
			.notNull()
			.default(false),
		createdAt: createdAt(),
	},
	(t) => [
		index('submissions_event_participant_challenge_idx').on(
			t.eventId,
			t.participantId,
			t.challengeId,
		),
	],
);

// ── solves (scored, one per participant/challenge) ──────────────────────────
export const solves = sqliteTable(
	'solves',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		participantId: integer('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		challengeId: integer('challenge_id')
			.notNull()
			.references(() => challenges.id, { onDelete: 'cascade' }),
		solvedAt: integer('solved_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		timeFactor: integer('time_factor').notNull(), // per-mille (500..1000)
		hintFactor: integer('hint_factor').notNull(), // per-mille (500 or 1000)
		finalScore: integer('final_score').notNull(), // milli-points
	},
	(t) => [
		uniqueIndex('solves_event_participant_challenge_unq').on(
			t.eventId,
			t.participantId,
			t.challengeId,
		),
		index('solves_event_participant_idx').on(t.eventId, t.participantId),
		index('solves_event_challenge_idx').on(t.eventId, t.challengeId),
	],
);

// ── hint_usage ──────────────────────────────────────────────────────────────
export const hintUsage = sqliteTable(
	'hint_usage',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		participantId: integer('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		challengeId: integer('challenge_id')
			.notNull()
			.references(() => challenges.id, { onDelete: 'cascade' }),
		hintNumber: integer('hint_number').notNull(), // 1 or 2
		usedAt: integer('used_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex('hint_usage_event_participant_challenge_hint_unq').on(
			t.eventId,
			t.participantId,
			t.challengeId,
			t.hintNumber,
		),
	],
);

// ── anti_cheat_events ───────────────────────────────────────────────────────
export const antiCheatEvents = sqliteTable(
	'anti_cheat_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		submitterParticipantId: integer('submitter_participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		challengeId: integer('challenge_id')
			.notNull()
			.references(() => challenges.id, { onDelete: 'cascade' }),
		// The participant whose personalized answer was submitted by someone else.
		matchedParticipantId: integer('matched_participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		submittedAnswer: text('submitted_answer').notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		index('anti_cheat_event_submitter_idx').on(
			t.eventId,
			t.submitterParticipantId,
		),
	],
);

// ── first_bloods (one per challenge per event) ──────────────────────────────
export const firstBloods = sqliteTable(
	'first_bloods',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		challengeId: integer('challenge_id')
			.notNull()
			.references(() => challenges.id, { onDelete: 'cascade' }),
		participantId: integer('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		claimedAt: integer('claimed_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex('first_bloods_event_challenge_unq').on(
			t.eventId,
			t.challengeId,
		),
	],
);

// ── admin_actions (audit; created now, not deferred to Phase 11) ────────────
export const adminActions = sqliteTable(
	'admin_actions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		// Nullable → global (non-event-scoped) admin actions.
		eventId: integer('event_id').references(() => events.id, {
			onDelete: 'cascade',
		}),
		actionType: text('action_type').notNull(),
		payload: text('payload'), // JSON, nullable
		actor: text('actor').notNull(),
		createdAt: createdAt(),
	},
	(t) => [index('admin_actions_event_time_idx').on(t.eventId, t.createdAt)],
);

// ── announcements (first-class persistent state) ────────────────────────────
export const announcements = sqliteTable(
	'announcements',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		message: text('message').notNull(),
		createdAt: createdAt(),
	},
	(t) => [index('announcements_event_time_idx').on(t.eventId, t.createdAt)],
);

// ── challenge_bypasses (first-class persistent state) ───────────────────────
export const challengeBypasses = sqliteTable('challenge_bypasses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	eventId: integer('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade' }),
	challengeId: integer('challenge_id')
		.notNull()
		.references(() => challenges.id, { onDelete: 'cascade' }),
	reason: text('reason'),
	actor: text('actor').notNull(),
	createdAt: createdAt(),
});

// ── login_rate_limit (persistent, Workers-instance-agnostic) ────────────────
// Fixed-window counter per scope. `subject` is the roll number (string) for the
// 'roll' scope, or an HMAC(ip, RATE_LIMIT_SECRET) hex digest for the 'ip' scope
// — raw IPs are never persisted (privacy §14).
export const RATE_LIMIT_SCOPES = ['roll', 'ip'] as const;

export const loginRateLimit = sqliteTable(
	'login_rate_limit',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		eventId: integer('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		scope: text('scope', { enum: RATE_LIMIT_SCOPES }).notNull(),
		subject: text('subject').notNull(),
		windowStart: integer('window_start', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		failureCount: integer('failure_count').notNull().default(0),
	},
	(t) => [
		uniqueIndex('login_rate_limit_scope_unq').on(
			t.eventId,
			t.scope,
			t.subject,
		),
	],
);

export const schema = {
	events,
	participants,
	sessions,
	challenges,
	submissions,
	solves,
	hintUsage,
	antiCheatEvents,
	firstBloods,
	adminActions,
	announcements,
	challengeBypasses,
	loginRateLimit,
};

export type Schema = typeof schema;
