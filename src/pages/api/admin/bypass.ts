import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { bypassSchema } from '../../../lib/validation/admin';
import { bypassChallenge, BypassError } from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = bypassSchema.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	try {
		const res = await bypassChallenge(g.db, { eventId: g.event.id, slot: parsed.data.slot, reason: parsed.data.reason });
		return adminJson({ ok: true, ...res }, 200);
	} catch (e) {
		if (e instanceof BypassError) return adminJson({ error: e.message }, 400);
		throw e;
	}
};
