import type { InferSelectModel } from 'drizzle-orm';
import type { events, participants, sessions } from '../db/schema';

export type EventRow = InferSelectModel<typeof events>;
export type ParticipantRow = InferSelectModel<typeof participants>;
export type SessionRow = InferSelectModel<typeof sessions>;

/** Resolved server-side identity for an authenticated request. */
export interface AuthContext {
	session: SessionRow;
	participant: ParticipantRow;
	event: EventRow;
}
