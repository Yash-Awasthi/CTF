/**
 * Dynamic challenge scoring from dynamicvaluechallenge — adaptive point values.
 */
export interface DynamicChallenge {
    id: string;
    title: string;
    category: string;
    basePoints: number;
    currentPoints: number;
    solves: number;
    difficulty: number; // 1-10
    timeDecayRate: number;
    createdAt: number;
}

export function computeDynamicPoints(challenge: DynamicChallenge, totalSolves: number, avgSolves: number): number {
    const popularityFactor = totalSolves > 0 ? Math.max(0.5, 1 - (challenge.solves / totalSolves) * 0.5) : 1;
    const difficultyFactor = challenge.difficulty / 5;
    const hoursElapsed = (Date.now() - challenge.createdAt) / (1000 * 60 * 60);
    const decayFactor = Math.max(0.3, 1 - challenge.timeDecayRate * hoursElapsed / 100);
    return Math.round(challenge.basePoints * popularityFactor * difficultyFactor * decayFactor);
}

export function rebalanceChallenges(challenges: DynamicChallenge[]): DynamicChallenge[] {
    const totalSolves = challenges.reduce((sum, c) => sum + c.solves, 0);
    const avgSolves = totalSolves / challenges.length;
    return challenges.map(c => ({
        ...c,
        currentPoints: computeDynamicPoints(c, totalSolves, avgSolves),
    }));
}
