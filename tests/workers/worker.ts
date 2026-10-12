// Test-only entry: the real main imports Astro's build-time virtual modules.
export default {
	fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler<Env>;
