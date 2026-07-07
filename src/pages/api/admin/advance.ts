import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { advanceSchema } from '../../../lib/validation/admin';
import { markEventReady, startEvent, beginEventReview, publishEventResults, archiveEvent } from '../../../lib/event/state';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = advanceSchema.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	const id = g.event.id;
	try {
		switch (parsed.data.action) {
			case 'ready': await markEventReady(g.db, id); break;
			case 'start': await startEvent(g.db, id); break;
			case 'review': await beginEventReview(g.db, id); break;
			case 'publish': await publishEventResults(g.db, id); break;
			case 'archive': await archiveEvent(g.db, id); break;
		}
		return adminJson({ ok: true }, 200);
	} catch (e) {
		return adminJson({ error: (e as Error).message }, 409);
	}
};
