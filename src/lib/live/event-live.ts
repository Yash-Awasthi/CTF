import { DurableObject } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { events } from '../db/schema';
import { ensureCurrentEventState } from '../event/state';
import { readUpdates, type UpdateCursors, type UpdateSnapshot } from '../sse';

/** One message per WebSocket frame, JSON-encoded. */
export type LiveFrame =
	| { type: 'state'; stateVersion: string; timing: UpdateSnapshot['timing'] }
	| { type: 'firstblood'; id: number; slot: number; message: string }
	| { type: 'announcement'; id: number; message: string };

function toFrames(snap: UpdateSnapshot): string[] {
	const frames: LiveFrame[] = [
		{ type: 'state', stateVersion: snap.stateVersion, timing: snap.timing },
		...snap.firstBloods.map((f) => ({ type: 'firstblood' as const, ...f })),
		...snap.announcements.map((a) => ({ type: 'announcement' as const, ...a })),
	];
	return frames.map((f) => JSON.stringify(f));
}

/**
 * Live channel for one event (addressed by `idFromName(String(eventId))`).
 * D1 stays the source of truth: writers call `sync()` after committing, and the
 * object pushes whatever is newer than what it last broadcast. Sockets use the
 * hibernation API, so idle players cost nothing.
 */
export class EventLive extends DurableObject<Env> {
	private async snapshot(eventId: number, cursors: UpdateCursors): Promise<UpdateSnapshot | null> {
		const db = createDb(this.env.DB);
		const now = new Date();
		const row = await db.select().from(events).where(eq(events.id, eventId)).get();
		if (!row) return null;
		return readUpdates(db, await ensureCurrentEventState(db, row, now), cursors, now);
	}

	/** WebSocket upgrade; replays everything after the client's cursors to this socket only. */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const eventId = Number(url.searchParams.get('event'));
		const cursors = {
			fb: Number(url.searchParams.get('fb')) || 0,
			ann: Number(url.searchParams.get('ann')) || 0,
		};
		const snap = await this.snapshot(eventId, cursors);
		if (!snap) return new Response('event not found', { status: 404 });

		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		for (const frame of toFrames(snap)) server.send(frame);
		return new Response(null, { status: 101, webSocket: client });
	}

	/** Broadcast changes committed to D1 since the last sync. */
	async sync(eventId: number): Promise<void> {
		await this.ctx.blockConcurrencyWhile(async () => {
			const last = this.ctx.storage.kv.get<UpdateCursors>('cursors') ?? { fb: 0, ann: 0 };
			const snap = await this.snapshot(eventId, last);
			if (!snap) return;
			const frames = toFrames(snap);
			for (const ws of this.ctx.getWebSockets()) {
				for (const frame of frames) ws.send(frame);
			}
			this.ctx.storage.kv.put('cursors', snap.cursors);
			this.ctx.storage.kv.put('eventId', eventId);
			// Nobody writes when the clock runs out, so wake up then to publish the freeze.
			if (snap.timing.isLive && snap.timing.endsAt !== null) {
				await this.ctx.storage.setAlarm(snap.timing.endsAt * 1000);
			} else {
				await this.ctx.storage.deleteAlarm();
			}
		});
	}

	async alarm(): Promise<void> {
		const eventId = this.ctx.storage.kv.get<number>('eventId');
		if (eventId !== undefined) await this.sync(eventId);
	}

	async webSocketMessage(): Promise<void> {
		// Clients only listen; cursors travel in the connect URL.
	}
}
