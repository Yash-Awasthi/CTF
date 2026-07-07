import { env } from 'cloudflare:workers';

/**
 * Access Cloudflare runtime bindings. In Astro 7 / adapter v14 the old
 * `Astro.locals.runtime.env` accessor was removed in favour of the
 * `cloudflare:workers` virtual module, which works in both `wrangler dev`
 * and production. `env` is typed as the generated global `Env`.
 */
export function getEnv(): Env {
	return env as unknown as Env;
}
