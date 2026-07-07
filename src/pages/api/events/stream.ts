import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { events } from '../../../lib/db/schema';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { readUpdates, sseFrame, type UpdateCursors } from '../../../lib/sse';

export const prerender = false;

const POLL_MS = 4000; // NOT a timer tick — the browser computes the countdown.
const MAX_ITERATIONS = 20; // ~80s, then close; EventSource auto-reconnects.

/**
 * Participant live-update stream (SSE). Authenticated + event-scoped. Reads
 * authoritative D1 every POLL_MS and emits diffs (state/timing changes, first
 * blood, announcements). No timer ticks are streamed. Cross-isolate correctness
 * comes from each stream reading D1 itself — not a shared in-memory broadcaster.
 * Missed events are recoverable via the persisted state on reconnect.
 */
export const GET: APIRoute = async ({ locals, url, request }) => {
	const auth = locals.auth;
	if (!auth) {
		return new Response('unauthenticated', { status: 401 });
	}

	const db = createDb(getEnv().DB);
	const cursors: UpdateCursors = {
		fb: Number(url.searchParams.get('fb') ?? 0) || 0,
		ann: Number(url.searchParams.get('ann') ?? 0) || 0,
	};
	let lastStateVersion = '';

	const encoder = new TextEncoder();
	const eventId = auth.event.id;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (s: string) => controller.enqueue(encoder.encode(s));
			// Advise clients to reconnect quickly after our capped lifetime.
			send('retry: 3000\n\n');

			try {
				for (let i = 0; i < MAX_ITERATIONS; i++) {
					if (request.signal.aborted) break;
					const now = new Date();
					// Re-load the event each tick so state/timer changes are picked up.
					const fresh = await db.select().from(events).where(eq(events.id, eventId)).get();
					const event = fresh
						? await ensureCurrentEventState(db, fresh, now)
						: auth.event;
					const snap = await readUpdates(db, event, cursors, now);

					if (snap.stateVersion !== lastStateVersion) {
						lastStateVersion = snap.stateVersion;
						send(sseFrame('state', { stateVersion: snap.stateVersion, timing: snap.timing }));
					}
					for (const fb of snap.firstBloods) send(sseFrame('firstblood', { slot: fb.slot, message: fb.message }, fb.id));
					for (const a of snap.announcements) send(sseFrame('announcement', { message: a.message }, a.id));
					cursors.fb = snap.cursors.fb;
					cursors.ann = snap.cursors.ann;

					send(`: hb ${eventId}\n\n`); // heartbeat comment
					await new Promise((r) => setTimeout(r, POLL_MS));
				}
			} catch {
				// fall through to close
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		status: 200,
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
		},
	});
};
