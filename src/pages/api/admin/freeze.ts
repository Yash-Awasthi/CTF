import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { eventScoped } from '../../../lib/validation/admin';
import { freezeEvent } from '../../../lib/event/state';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = eventScoped.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	try {
		await freezeEvent(g.db, g.event.id);
		return adminJson({ ok: true }, 200);
	} catch (e) {
		return adminJson({ error: (e as Error).message }, 409);
	}
};
