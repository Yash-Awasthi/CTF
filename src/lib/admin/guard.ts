/**
 * Shared admin-route guard. Enforces admin cookie auth, (for mutations)
 * same-origin CSRF defence, Cloudflare Access identity (if configured),
 * and resolves the target event. Returns either a ready-to-use context
 * or a Response to short-circuit the route.
 */
import type { AstroCookies } from 'astro';
import { createDb, type DB } from '../db/client';
import { getEnv } from '../runtime';
import { resolveEventBySlug } from '../event/resolve';
import type { EventRow } from '../auth/types';
import { isAdmin, isSameOrigin } from './auth';
import { guardAdminWithAccess } from '../auth/access';

export function adminJson(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json',
			'X-API-Version': '1.0.0',
			'X-Content-Type-Options': 'nosniff',
			'X-Frame-Options': 'DENY',
			'Referrer-Policy': 'strict-origin-when-cross-origin',
			'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
		},
	});
}

export interface AdminContext {
	env: Env;
	db: DB;
	event: EventRow;
}

/** Guard an admin route. `mutation` adds the same-origin (CSRF) requirement. */
export async function guardAdmin(
	request: Request,
	cookies: AstroCookies,
	eventSlug: string | undefined,
	opts: { mutation: boolean },
): Promise<AdminContext | Response> {
	const env = getEnv();
	const db = createDb(env.DB);

	// SECURITY: Validate input BEFORE auth checks (fail-fast, no timing leaks)
	if (!eventSlug) return adminJson({ error: 'event_required' }, 400);

	// Layer 1: Application-level cookie auth
	if (!(await isAdmin(cookies, db))) return adminJson({ error: 'unauthorized' }, 401);
	if (opts.mutation && !isSameOrigin(request)) {
		return adminJson({ error: 'bad_origin' }, 403);
	}

	// Layer 2: Cloudflare Access identity, enforced only when ACCESS_ADMIN_EMAILS is
	// configured. isAccessAdmin denies when it is unset, which locks out every admin.
	const access = guardAdminWithAccess(request, true);
	if (!access.allowed) {
		// SECURITY: Do NOT leak email or identity details in error response.
		return adminJson({
			error: access.reason ?? 'access_not_authorized',
			message: 'Your identity is not authorized for admin access.',
		}, 403);
	}

	// Audit log: record Access identity for compliance (server-side only)
	if (access.accessIdentity) {
		console.log(`[ACCESS] Admin ${access.accessIdentity.email} accessed ${eventSlug} (req: ${access.accessIdentity.requestId})`);
	}

	const event = await resolveEventBySlug(db, eventSlug);
	if (!event) return adminJson({ error: 'event_not_found' }, 404);
	return { env, db, event };
}
