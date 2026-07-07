import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { getAdminOverview } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url }) => {
	const g = await guardAdmin(request, cookies, url.searchParams.get('event') ?? undefined, { mutation: false });
	if (g instanceof Response) return g;
	const now = new Date();
	const event = await ensureCurrentEventState(g.db, g.event, now);
	return adminJson(await getAdminOverview(g.db, event, now), 200);
};
