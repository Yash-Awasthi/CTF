import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import {
	createAdminSession, setAdminCookie, verifyAdminPassword, isSameOrigin,
	hashIp, checkAdminRateLimit, recordAdminFailure, resetAdminFailures,
} from '../../../lib/admin';

export const prerender = false;

function json(b: unknown, s: number, h?: Record<string, string>) {
	return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...h } });
}
function clientIp(request: Request): string | null {
	return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/** POST /api/admin/login {password} — password == ADMIN_SECRET (constant-time). */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isSameOrigin(request)) return json({ error: 'bad_origin' }, 403);
	const env = getEnv();
	const db = createDb(env.DB);

	const ip = clientIp(request);
	const ipHash = ip ? await hashIp(ip, env.RATE_LIMIT_SECRET) : null;
	if (ipHash) {
		const rl = await checkAdminRateLimit(db, ipHash);
		if (rl.blocked) return json({ error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds }, 429, { 'retry-after': String(rl.retryAfterSeconds) });
	}

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'invalid_input' }, 400); }
	const password = (body as { password?: unknown })?.password;
	if (typeof password !== 'string') return json({ error: 'invalid_input' }, 400);

	if (!verifyAdminPassword(env, password)) {
		if (ipHash) await recordAdminFailure(db, ipHash);
		return json({ error: 'invalid_credentials' }, 401);
	}
	if (ipHash) await resetAdminFailures(db, ipHash);

	const { rawToken } = await createAdminSession(db);
	setAdminCookie(cookies, rawToken);
	return json({ ok: true }, 200);
};
