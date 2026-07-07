import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { clearAdminCookie, readAdminCookie, revokeAdminSession } from '../../../lib/admin';

export const prerender = false;

/** POST /api/admin/logout — revoke the current admin session + clear cookie. */
export const POST: APIRoute = async ({ cookies }) => {
	const db = createDb(getEnv().DB);
	await revokeAdminSession(db, readAdminCookie(cookies));
	clearAdminCookie(cookies);
	return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};
