import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { announceSchema } from '../../../lib/validation/admin';
import { createAnnouncement } from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = announceSchema.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	const res = await createAnnouncement(g.db, { eventId: g.event.id, message: parsed.data.message });

	return adminJson({ ok: true, id: res.id }, 200);
};
