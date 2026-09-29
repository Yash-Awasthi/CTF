import { z } from 'zod';

/** Admin mutation input schemas. Every admin route validates before acting. */
export const eventScoped = z.object({ eventSlug: z.string().min(1).max(100) });

export const extendSchema = eventScoped.extend({
	seconds: z.coerce.number().int().positive().max(172_800),
});

export const advanceSchema = eventScoped.extend({
	action: z.enum(['ready', 'start', 'review', 'publish', 'archive']),
});

export const announceSchema = eventScoped.extend({
	message: z.string().min(1).max(1000),
});

export const resetSessionSchema = eventScoped.extend({
	participantId: z.coerce.number().int().positive(),
});

export const bypassSchema = eventScoped.extend({
	slot: z.coerce.number().int().min(1).max(30),
	reason: z.string().max(500).optional(),
});
