import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { resetSessionSchema } from '../../../lib/validation/admin';
import { resetParticipantSession } from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let body: unknown;
	try { body = await request.json(); } catch { return adminJson({ error: 'invalid_input' }, 400); }
	const parsed = resetSessionSchema.safeParse(body);
	if (!parsed.success) return adminJson({ error: 'invalid_input' }, 400);
	const g = await guardAdmin(request, cookies, parsed.data.eventSlug, { mutation: true });
	if (g instanceof Response) return g;
	const res = await resetParticipantSession(g.db, { eventId: g.event.id, participantId: parsed.data.participantId });
	return adminJson({ ok: true, revoked: res.revoked }, 200);
};
