import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { extendSchema } from '../../../lib/validation/admin';
import { extendEvent } from '../../../lib/event/state';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = extendSchema.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	try {
		const timing = await extendEvent(g.db, g.event.id, parsed.data.seconds);
		return adminJson({ ok: true, timing }, 200);
	} catch (e) {
		return adminJson({ error: (e as Error).message }, 409);
	}
};
