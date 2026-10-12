import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { participants } from '../../../lib/db/schema';
import { resolveEventBySlug } from '../../../lib/event/resolve';
import { isLoginAllowed } from '../../../lib/auth/authenticate';
import { validateParticipantCredentials } from '../../../lib/auth/credentials';
import { createSession } from '../../../lib/auth/sessions';
import { setSessionCookie } from '../../../lib/auth/cookies';
import { allowAttempt, hashIp, recordFailure } from '../../../lib/auth/rate-limit';
import { RATE_LIMIT_PERIOD_SECONDS } from '../../../lib/auth/constants';
import { loginSchema } from '../../../lib/validation/auth';

export const prerender = false;

function json(body: unknown, status: number, headers?: Record<string, string>) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers },
	});
}

function redirect(location: string, headers?: Record<string, string>) {
	return new Response(null, { status: 303, headers: { location, ...headers } });
}

function getClientIp(request: Request): string | null {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		null
	);
}

/**
 * Login accepts EITHER JSON (programmatic API, §15) or a native form POST
 * (progressive-enhancement UI). JSON requests get JSON responses; form requests
 * get 303 redirects (success → /{slug}/home, failure → /{slug}/login?error=…).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
	const env = getEnv();
	const db = createDb(env.DB);

	const contentType = request.headers.get('content-type') ?? '';
	const isForm =
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data');

	// 1. Read + validate input (never echo the submitted password).
	let payload: unknown;
	try {
		if (isForm) {
			const fd = await request.formData();
			payload = {
				eventSlug: fd.get('eventSlug'),
				rollNumber: fd.get('rollNumber'),
				password: fd.get('password'),
			};
		} else {
			payload = await request.json();
		}
	} catch {
		return isForm ? redirect('/?error=invalid_input') : json({ error: 'invalid_input' }, 400);
	}
	const parsed = loginSchema.safeParse(payload);
	if (!parsed.success) {
		const slug =
			typeof (payload as { eventSlug?: unknown })?.eventSlug === 'string'
				? (payload as { eventSlug: string }).eventSlug
				: '';
		return isForm
			? redirect(`/${slug}/login?error=invalid_input`)
			: json({ error: 'invalid_input' }, 400);
	}
	const { eventSlug, rollNumber, password } = parsed.data;
	const loginUrl = `/${eventSlug}/login`;

	// 2. Event resolution.
	const event = await resolveEventBySlug(db, eventSlug);
	if (!event) {
		return isForm
			? redirect(`${loginUrl}?error=event_not_found`)
			: json({ error: 'event_not_found' }, 404);
	}
	if (!isLoginAllowed(event.state)) {
		return isForm
			? redirect(`${loginUrl}?error=event_closed`)
			: json({ error: 'event_closed' }, 403);
	}

	// 3. Rate-limit scopes: roll (event+roll) and hashed IP.
	const rollKey = {
		eventId: event.id,
		scope: 'roll' as const,
		subject: String(rollNumber),
	};
	const ip = getClientIp(request);
	const ipKey = ip
		? {
				eventId: event.id,
				scope: 'ip' as const,
				subject: await hashIp(ip, env.RATE_LIMIT_SECRET),
			}
		: null;

	// Every attempt spends from both limiters, so the IP limit is sized above the roster.
	const rollOk = await allowAttempt(env.LOGIN_ROLL_LIMITER, `${event.id}:${rollNumber}`);
	const ipOk = ipKey ? await allowAttempt(env.LOGIN_IP_LIMITER, `${event.id}:${ipKey.subject}`) : true;
	if (!rollOk || !ipOk) {
		const retry = RATE_LIMIT_PERIOD_SECONDS;
		return isForm
			? redirect(`${loginUrl}?error=rate_limited&retry=${retry}`)
			: json({ error: 'rate_limited', retryAfterSeconds: retry }, 429, {
					'retry-after': String(retry),
				});
	}

	// 4. Credential validation (generic failure — no enumeration).
	const participant = await db
		.select()
		.from(participants)
		.where(
			and(
				eq(participants.eventId, event.id),
				eq(participants.rollNumber, rollNumber),
			),
		)
		.get();

	const ok = !!participant && (await validateParticipantCredentials(participant, password));
	if (!ok) {
		await recordFailure(db, rollKey);
		if (ipKey) await recordFailure(db, ipKey);
		return isForm
			? redirect(`${loginUrl}?error=invalid_credentials`)
			: json({ error: 'invalid_credentials' }, 401);
	}

	// 5. Success → replace session, set opaque cookie.

	const { rawToken } = await createSession(db, { event, participant });
	setSessionCookie(cookies, rawToken);

	const home = `/${event.slug}/home`;
	return isForm ? redirect(home) : json({ ok: true, redirect: home }, 200);
};
