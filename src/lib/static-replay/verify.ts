/**
 * Static-replay answer verification. Reuses the shared normalizeAnswer so the
 * archival check matches the live normalization rule. Client-side + non-secret
 * by design (archival, non-competitive). Live secure validation stays on the
 * server (src/lib/challenges/engine.ts) and is unaffected.
 */
import { normalizeAnswer } from '../validation/answer';

export function replayVerify(input: string, expectedAnswer: string): boolean {
	return normalizeAnswer(input) === normalizeAnswer(expectedAnswer);
}
