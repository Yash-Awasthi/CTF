// Test-only entry: the real main imports Astro's build-time virtual modules.
export { EventLive } from '../../src/lib/live';

export default {
	fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler<Env>;
