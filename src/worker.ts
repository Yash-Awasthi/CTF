import { handle } from '@astrojs/cloudflare/handler';
import { handleLiveSocket, LIVE_PATH } from './lib/live';

export { EventLive } from './lib/live';

export default {
	async fetch(request, env, ctx) {
		if (new URL(request.url).pathname === LIVE_PATH) return handleLiveSocket(request, env);
		return handle(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
