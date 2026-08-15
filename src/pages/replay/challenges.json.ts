import type { APIRoute } from 'astro';
import { buildReplayManifest } from '../../lib/static-replay';

// Prerendered at build → emitted as a static file. No secrets/answers/seeds.
export const prerender = true;

export const GET: APIRoute = () =>
	new Response(JSON.stringify({ salt: 'public', challenges: buildReplayManifest() }), {
		headers: { 'content-type': 'application/json' },
	});
