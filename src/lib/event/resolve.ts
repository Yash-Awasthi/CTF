import { eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { events } from '../db/schema';
import type { EventRow } from '../auth/types';

/**
 * Public event identity is the slug (e.g. `case-files-dev-2026`); internal
 * DB ids are never exposed as the primary public identifier. Reusable by every
 * event-scoped route.
 */
export async function resolveEventBySlug(
	db: AnySQLiteDb,
	slug: string,
): Promise<EventRow | null> {
	const row = await db
		.select()
		.from(events)
		.where(eq(events.slug, slug))
		.get();
	return row ?? null;
}
