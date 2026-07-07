import type { AstroCookies } from 'astro';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants';

/**
 * Cookie policy: HttpOnly, SameSite=Lax, Path=/, Secure in production. The
 * cookie carries ONLY the opaque session token — no roll number, participant
 * id, event id, score, or challenge state.
 */
function baseCookieOptions(secure: boolean) {
	return {
		httpOnly: true,
		secure,
		sameSite: 'lax' as const,
		path: '/',
	};
}

const isProd = import.meta.env.PROD;

export function setSessionCookie(
	cookies: AstroCookies,
	rawToken: string,
	secure: boolean = isProd,
): void {
	cookies.set(SESSION_COOKIE, rawToken, {
		...baseCookieOptions(secure),
		maxAge: SESSION_TTL_SECONDS,
	});
}

export function clearSessionCookie(
	cookies: AstroCookies,
	secure: boolean = isProd,
): void {
	cookies.delete(SESSION_COOKIE, baseCookieOptions(secure));
}

export function readSessionCookie(cookies: AstroCookies): string | undefined {
	return cookies.get(SESSION_COOKIE)?.value;
}
