/**
 * Transform final live leaderboard entries → permanent static standings.
 * Pure (no D1): the export tool reads authoritative final data, this shapes it.
 *   - excludes eliminated participants (existing policy),
 *   - deterministic order (score DESC → earliest final solve → roll ASC),
 *   - UNMASKED roll numbers (locked decision — intentional, not a leak),
 *   - score shown from milli-points (÷1000).
 */
export interface FinalEntry {
	rollNumber: number;
	score: number; // milli-points
	solveCount: number;
	lastSolveAt: number | null;
	eliminated: boolean;
}

export interface StaticStanding {
	rank: number;
	rollNumber: number;
	scoreMilli: number;
	score: number; // points
	solveCount: number;
}

export function toStaticLeaderboard(entries: FinalEntry[]): StaticStanding[] {
	const eligible = entries.filter((e) => !e.eliminated);
	eligible.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const al = a.lastSolveAt ?? Number.POSITIVE_INFINITY;
		const bl = b.lastSolveAt ?? Number.POSITIVE_INFINITY;
		if (al !== bl) return al - bl;
		return a.rollNumber - b.rollNumber;
	});
	return eligible.map((e, i) => ({
		rank: i + 1,
		rollNumber: e.rollNumber,
		scoreMilli: e.score,
		score: e.score / 1000,
		solveCount: e.solveCount,
	}));
}
