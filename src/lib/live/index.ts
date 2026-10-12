import { createDb } from '../db/client';
import { SESSION_COOKIE } from '../auth/constants';
import { findValidSession } from '../auth/sessions';

export { EventLive, type LiveFrame } from './event-live';

export const LIVE_PATH = '/api/events/live';

function liveStub(env: Env, eventId: number) {
	return env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(String(eventId)));
}

/**
 * Push freshly committed D1 changes to connected players. Never throws: the write
 * already succeeded, and clients recover anything missed from D1 on reconnect.
 */
export async function syncLive(env: Env, eventId: number): Promise<void> {
	try {
		await liveStub(env, eventId).sync(eventId);
	} catch (e) {
		console.error('live sync failed', e);
	}
}

function readCookie(request: Request, name: string): string | undefined {
	for (const part of request.headers.get('cookie')?.split(';') ?? []) {
		const [k, ...v] = part.trim().split('=');
		if (k === name) return decodeURIComponent(v.join('='));
	}
	return undefined;
}

/**
 * Authenticated WebSocket upgrade into the event's live channel. Served by the
 * Worker entry before Astro, because a 101 response must reach the runtime as is.
 */
export async function handleLiveSocket(request: Request, env: Env): Promise<Response> {
	if (request.headers.get('upgrade') !== 'websocket') {
		return new Response('expected websocket', { status: 426 });
	}
	const auth = await findValidSession(createDb(env.DB), readCookie(request, SESSION_COOKIE));
	if (!auth) return new Response('unauthenticated', { status: 401 });

	const url = new URL(request.url);
	const target = new URL('https://live/connect');
	target.searchParams.set('event', String(auth.event.id));
	target.searchParams.set('fb', url.searchParams.get('fb') ?? '0');
	target.searchParams.set('ann', url.searchParams.get('ann') ?? '0');
	return liveStub(env, auth.event.id).fetch(new Request(target, request));
}
