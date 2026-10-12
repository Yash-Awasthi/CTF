import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDb, type Db } from './db';
import { announcements, events } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncLive, type LiveFrame } from '../../src/lib/live';

let db: Db;
let eventId: number;

beforeEach(async () => {
	db = await freshDb();
	({ eventId } = await seedEvent(db, DEV_EVENT));
});

const stubFor = (id: number) => env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(String(id)));

async function connect(fb = 0, ann = 0): Promise<LiveFrame[]> {
	const res = await stubFor(eventId).fetch(`https://live/connect?event=${eventId}&fb=${fb}&ann=${ann}`, {
		headers: { upgrade: 'websocket' },
	});
	expect(res.status).toBe(101);
	const frames: LiveFrame[] = [];
	res.webSocket!.addEventListener('message', (e) => frames.push(JSON.parse(e.data as string)));
	res.webSocket!.accept();
	return frames;
}

describe('EventLive', () => {
	it('replays state and announcements newer than the client cursors on connect', async () => {
		const [a1] = await db.insert(announcements).values({ eventId, message: 'one' }).returning();
		await db.insert(announcements).values({ eventId, message: 'two' });

		const frames = await connect(0, a1.id);
		await vi.waitFor(() => expect(frames).toHaveLength(2));
		expect(frames[0].type).toBe('state');
		expect(frames[1]).toMatchObject({ type: 'announcement', message: 'two' });
	});

	it('broadcasts committed changes to connected sockets on sync', async () => {
		const frames = await connect();
		await vi.waitFor(() => expect(frames).toHaveLength(1));

		await db.insert(announcements).values({ eventId, message: 'hello' });
		await syncLive(env, eventId);
		await vi.waitFor(() => expect(frames.some((f) => f.type === 'announcement' && f.message === 'hello')).toBe(true));
	});

	it('arms an alarm at the end of a live event so the freeze is published', async () => {
		const startedAt = new Date();
		await db.update(events).set({ state: 'LIVE', startedAt, durationSeconds: 3600 }).where(eq(events.id, eventId));
		await syncLive(env, eventId);

		const alarm = await runInDurableObject(stubFor(eventId), (_, state) => state.storage.getAlarm());
		expect(alarm).toBe((Math.floor(startedAt.getTime() / 1000) + 3600) * 1000);
	});
});
