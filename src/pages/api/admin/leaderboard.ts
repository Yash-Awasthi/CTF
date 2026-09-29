import type { APIRoute } from 'astro';
import { guardAdmin, adminJson } from '../../../lib/admin/guard';
import { getAdminLeaderboard } from '../../../lib/leaderboard/index';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url }) => {
	const g = await guardAdmin(request, cookies, url.searchParams.get('event') ?? undefined, { mutation: false });
	if (g instanceof Response) return g;
	return adminJson({ leaderboard: await getAdminLeaderboard(g.db, g.event.id) }, 200);
};
