/**
 * Versioned event-secret resolution.
 *
 * D1 stores ONLY `secret_version` (e.g. "v1"). The actual secret lives in the
 * runtime environment and is never persisted, logged, or returned to clients.
 * This resolver maps a version to its runtime binding name; adding a future
 * version is a two-line change (new map entry + new binding) with no fallback.
 *
 * Design rationale (Cloudflare-simplest, type-safe):
 *  - A binding name per version keeps version → secret resolution explicit and
 *    greppable. `wrangler secret put` provides the value in production; `.dev.vars`
 *    provides a development-only value locally.
 *  - Unknown version → throw. Missing binding value → throw. Never fall back to
 *    another version, never use a default. Errors never contain secret material.
 */
import { utf8 } from './encoding';

/** Minimal shape this resolver reads — a superset of the generated `Env`. */
export type SecretEnv = Record<string, unknown>;

/**
 * Version → runtime binding name. `v1` maps to the existing `EVENT_SECRET`
 * binding. Future versions add e.g. `v2: 'EVENT_SECRET_V2'` alongside a new
 * `wrangler secret put EVENT_SECRET_V2`.
 */
export const SECRET_VERSION_BINDINGS: Readonly<Record<string, string>> = {
	v1: 'EVENT_SECRET',
};

/** Thrown when a secret version cannot be resolved. Never contains the secret. */
export class SecretResolutionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SecretResolutionError';
	}
}

/**
 * Resolve the raw event-secret bytes for a stored `secret_version`.
 * @throws SecretResolutionError for unknown versions or missing/empty bindings.
 */
export function resolveEventSecret(
	env: SecretEnv,
	secretVersion: string,
): Uint8Array {
	const binding = SECRET_VERSION_BINDINGS[secretVersion];
	if (!binding) {
		throw new SecretResolutionError(
			`Unknown secret_version: ${JSON.stringify(secretVersion)}`,
		);
	}
	const value = env[binding];
	if (typeof value !== 'string' || value.length === 0) {
		// Report the binding NAME only — never the value.
		throw new SecretResolutionError(
			`Missing secret binding ${binding} for secret_version ${secretVersion}`,
		);
	}
	return utf8(value);
}
