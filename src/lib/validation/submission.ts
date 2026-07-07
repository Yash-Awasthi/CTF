import { z } from 'zod';

/**
 * Input schemas for the submission + hint routes. Slot bounds are enforced here
 * AND re-validated by the challenge engine's parseSlot (defence in depth).
 * Crucially: the client NEVER supplies whether a hint was used — the server
 * derives that from persisted hint_usage.
 */
export const submitSchema = z.object({
	slot: z.coerce.number().int().min(1).max(30),
	answer: z.string().min(1).max(500),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export const hintSchema = z.object({
	slot: z.coerce.number().int().min(1).max(30),
	hintNumber: z.coerce.number().int().min(1).max(2),
});
export type HintInput = z.infer<typeof hintSchema>;
