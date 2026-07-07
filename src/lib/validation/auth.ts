import { z } from 'zod';

/**
 * Login input. Roll number is NOT range-validated here — authorization is by
 * participant lookup scoped to the event (multi-event correctness), not by a
 * global numeric range.
 */
export const loginSchema = z.object({
	eventSlug: z.string().min(1).max(100),
	rollNumber: z.coerce.number().int(),
	password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
