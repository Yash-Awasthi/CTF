/**
 * GET /{event}/evidence/{slot}/{name}
 *
 * Serves a challenge module's personalised evidence file (image, audio, archive
 * record). Same gate as the challenge page: login, live event, slot unlocked.
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../../../lib/db/client';
import { getEnv } from '../../../../lib/runtime';
import { gateArtifact } from '../../../../lib/challenges/artifact-gate';
import {
	generateChallengeForParticipant,
	getChallengeBySlot,
	getEventRoster,
	isValidSlot,
} from '../../../../lib/challenges';

export const prerender = false;

const notFound = () => new Response('Not found', { status: 404 });

export const GET: APIRoute = async ({ params, locals }) => {
	const auth = locals.auth;
	if (!auth || auth.event.slug !== params.event) return new Response('Authentication required.', { status: 401 });

	const slot = Number(params.slot);
	const module = isValidSlot(slot) ? getChallengeBySlot(slot) : undefined;
	if (!module?.artifact) return notFound();

	const denied = await gateArtifact(auth, slot);
	if (denied) return denied;

	const roster = await getEventRoster(createDb(getEnv().DB), auth.event.id);
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event: auth.event, rollNumber: auth.participant.rollNumber, roster },
		slot,
	);
	const file = await module.artifact(instance, params.name ?? '');
	if (!file) return notFound();

	return new Response(file.body, {
		headers: {
			'content-type': file.contentType,
			// Evidence never changes for a player, and audio players re-request it while seeking.
			'cache-control': 'private, max-age=3600',
			'x-content-type-options': 'nosniff',
			...(file.filename ? { 'content-disposition': `attachment; filename="${file.filename}"` } : {}),
			...file.headers,
		},
	});
};
