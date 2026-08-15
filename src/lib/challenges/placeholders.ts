/**
 * DEVELOPMENT-ONLY placeholder challenge modules — architecture fixtures, NOT
 * real CTF content. Every answer here is a synthetic `DEV-PLACEHOLDER-…` token
 * that could never be mistaken for a real puzzle answer. Real content replaces
 * these module-by-module in a later phase; the engine/registry/contract they
 * prove out stay unchanged.
 *
 * A factory builds all 30 so the fixtures stay minimal and uniform. Two slots
 * are attribution-enabled to exercise the Phase 4 attribution path end-to-end.
 *
 * Phase 13 note: production challenge authoring is DEFERRED. Slot 1 doubles as
 * the minimal development "Hello World" integration fixture — driven through the
 * real submit/hint/score/first-blood pipeline by the Playwright/Vitest suites.
 * No parallel challenge system exists for it; it is an ordinary registry module.
 */
import { ALPHABETS } from '../crypto/constants';
import { exactMatch } from './validators';
import type {
	ChallengeMetadata,
	ChallengeModule,
	GeneratedChallenge,
} from './types';

/** Clearly non-real answer marker. Asserted in tests to keep fixtures honest. */
export const DEV_ANSWER_PREFIX = 'DEV-PLACEHOLDER';

/** Slots that exercise attribution-enabled behavior in the placeholder set. */
export const ATTRIBUTION_SLOTS: readonly number[] = [8, 16];

interface PlaceholderPublic {
	slot: number;
	title: string;
	prompt: string;
	/** A deterministic per-participant display token (safe to show). */
	token: string;
}
interface PlaceholderPrivate {
	/** The correct answer for this participant. NEVER serialized to a client. */
	answer: string;
}

function tierForSlot(slot: number): ChallengeMetadata['tier'] {
	if (slot === 30) return 'capstone';
	if (slot >= 21) return 'hard';
	if (slot >= 11) return 'medium';
	return 'easy';
}

function basePointsForSlot(slot: number): number {
	switch (tierForSlot(slot)) {
		case 'easy':
			return 100;
		case 'medium':
			return 200;
		case 'hard':
			return 300;
		case 'capstone':
			return 500;
	}
}

function makePlaceholder(slot: number): ChallengeModule<PlaceholderPublic, PlaceholderPrivate> {
	const attributionEnabled = ATTRIBUTION_SLOTS.includes(slot);
	const key = slot === 30 ? 'final' : `placeholder-${String(slot).padStart(2, '0')}`;

	return {
		metadata: {
			slot,
			key,
			title: slot === 30 ? 'Final (placeholder)' : `Placeholder challenge ${slot}`,
			basePoints: basePointsForSlot(slot),
			tier: tierForSlot(slot),
			attributionEnabled,
		},
		hints: [
			{ order: 1, text: `Dev hint 1 for slot ${slot}.` },
			{ order: 2, text: `Dev hint 2 for slot ${slot}.` },
		],

		async generate(ctx): Promise<GeneratedChallenge<PlaceholderPublic, PlaceholderPrivate>> {
			// A deterministic display token, always shown (safe, non-secret).
			const token = await ctx.rng.string(8, ALPHABETS.upper);

			// Attribution challenges use the engine-assigned unique answer; ordinary
			// challenges derive a per-participant answer from the RNG (may collide).
			const answer = attributionEnabled
				? ctx.attributionAnswer!
				: `${DEV_ANSWER_PREFIX}-${slot}-${await ctx.rng.string(10, ALPHABETS.lower)}`;

			return {
				publicData: {
					slot,
					title: this.metadata.title,
					prompt:
						`DEV placeholder for slot ${slot}. Submit the answer assigned to ` +
						`investigator ${ctx.rollNumber}. (No real puzzle content yet.)`,
					token,
				},
				privateData: { answer },
			};
		},

		validate(instance, normalizedAnswer) {
			return exactMatch(normalizedAnswer, instance.privateData.answer);
		},

		...(attributionEnabled
			? {
					getAttributionPool(rosterSize: number): string[] {
						// A deterministic, unique-after-normalization pool larger than the
						// roster. Dev-only synthetic answers.
						const size = Math.max(rosterSize, 116) + 20;
						return Array.from(
							{ length: size },
							(_, i) => `${DEV_ANSWER_PREFIX}-attr-${slot}-${i}`,
						);
					},
				}
			: {}),
	};
}

/** All 30 placeholder modules, slot 1..30. */
export const PLACEHOLDER_CHALLENGES: ChallengeModule[] = Array.from(
	{ length: 30 },
	(_, i) => makePlaceholder(i + 1) as ChallengeModule,
);
