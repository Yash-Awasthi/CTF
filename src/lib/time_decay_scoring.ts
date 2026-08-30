/**
 * Time decay scoring from ctfd-time-decay-plugin — progressive point reduction.
 */
export interface DecayConfig {
    maxPoints: number;
    minPoints: number;
    decayRate: number; // percentage per hour
    decayWindow: number; // hours before max decay
    flatFloor: boolean; // stop at minPoints
}

export const DEFAULT_DECAY: DecayConfig = {
    maxPoints: 500,
    minPoints: 100,
    decayRate: 2.5,
    decayWindow: 48,
    flatFloor: true,
};

export function computeDecayedPoints(
    config: DecayConfig,
    hoursElapsed: number,
    isSolved: boolean = false,
): number {
    if (hoursElapsed <= 0) return config.maxPoints;
    const totalDecay = config.decayRate * hoursElapsed;
    const maxDecay = config.maxPoints - config.minPoints;
    const actualDecay = Math.min(totalDecay, maxDecay);
    let points = config.maxPoints - actualDecay;
    if (config.flatFloor) points = Math.max(config.minPoints, points);
    return Math.round(Math.max(0, points));
}

export function computeFirstBloodBonus(basePoints: number, bonusPercent: number = 10): number {
    return Math.round(basePoints * (1 + bonusPercent / 100));
}

export function computeTimeBonus(points: number, solveTimeMs: number, timeLimitMs: number): number {
    if (timeLimitMs <= 0) return points;
    const ratio = Math.max(0, 1 - solveTimeMs / timeLimitMs);
    return Math.round(points * (0.7 + 0.3 * ratio));
}

export interface SolveTimeline {
    challengeId: string;
    solveTime: number; // hours from start
    pointsAwarded: number;
    isFirstBlood: boolean;
    teamId: string;
}

export function buildDecayTimeline(
    solves: SolveTimeline[],
    config: DecayConfig = DEFAULT_DECAY,
): SolveTimeline[] {
    return solves
        .sort((a, b) => a.solveTime - b.solveTime)
        .map((solve, idx) => ({
            ...solve,
            pointsAwarded: computeDecayedPoints(config, solve.solveTime) * (solve.isFirstBlood ? 1.1 : 1),
            isFirstBlood: idx === 0 || solves.filter(s => s.challengeId === solve.challengeId && s.solveTime <= solve.solveTime).length === 1,
        }));
}
