import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { readSessionCookie, clearSessionCookie } from '../../../lib/auth/cookies';
import { revokeSessionByRawToken } from '../../../lib/auth/sessions';

export const prerender = false;

// Idempotent. Accepts JSON (→ JSON success) or a native form POST (→ 303 to the
// `redirect` field, or `/`). Clears the cookie and succeeds even with no session.
export const POST: APIRoute = async ({ request, cookies }) => {
	const raw = readSessionCookie(cookies);
	if (raw) {
		const db = createDb(getEnv().DB);
		await revokeSessionByRawToken(db, raw);
	}
	clearSessionCookie(cookies);

	const contentType = request.headers.get('content-type') ?? '';
	const isForm =
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data');

	if (isForm) {
		const fd = await request.formData().catch(() => null);
		const to = (fd?.get('redirect') as string) || '/';
		return new Response(null, { status: 303, headers: { location: to } });
	}
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
};
