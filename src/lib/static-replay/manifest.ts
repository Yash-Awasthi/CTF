/**
 * Sanitized static-replay challenge manifest. Built from the Phase 5 registry's
 * public METADATA only — never generation state, seeds, validators, or answers.
 * This is what the static build ships as `challenges.json`.
 */
import { getAllChallenges } from '../challenges/registry';

export interface ReplayChallenge {
	slot: number;
	key: string;
	title: string;
	tier: string;
	basePoints: number;
	prompt: string;
	hints: { order: number; text: string }[];
}

/** Deterministic manifest for the 30 slots (development placeholder content). */
export function buildReplayManifest(): ReplayChallenge[] {
	return getAllChallenges().map((m) => ({
		slot: m.metadata.slot,
		key: m.metadata.key,
		title: m.metadata.title,
		tier: m.metadata.tier,
		basePoints: m.metadata.basePoints,
		prompt:
			`Static replay — ${m.metadata.title}. Post-event archival content ` +
			`(development placeholder). Enter your solution below.`,
		hints: m.hints.map((h) => ({ order: h.order, text: h.text })),
	}));
}
