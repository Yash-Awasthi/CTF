import type { APIRoute } from 'astro';

export const prerender = false;

// Protected API: returns 401 JSON when unauthenticated (never redirects HTML).
// Auth is resolved by middleware into locals.auth.
export const GET: APIRoute = async ({ locals }) => {
	const auth = locals.auth;
	if (!auth) {
		return new Response(JSON.stringify({ error: 'unauthenticated' }), {
			status: 401,
			headers: { 'content-type': 'application/json' },
		});
	}
	return new Response(
		JSON.stringify({
			rollNumber: auth.participant.rollNumber,
			eventSlug: auth.event.slug,
			eventName: auth.event.name,
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } },
	);
};
