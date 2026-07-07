/**
 * Canonical answer normalization — the SINGLE source of truth shared by
 * attribution-uniqueness checks (Phase 4) and submission validation (Phase 5+).
 * Uniqueness of attribution answers is judged AFTER this normalization, so
 * "TOM", "tom", " Tom " collapse to one answer.
 */
export function normalizeAnswer(input: string): string {
	return input.trim().toLowerCase();
}
