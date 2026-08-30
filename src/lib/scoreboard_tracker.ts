/**
 * Scoreboard Tracker — Extracted from GryphonCTF scoreboard patterns.
 *
 * CTF scoreboard tracking with:
 * - Real-time solve tracking
 * - Team ranking
 * - Category-based scoring
 * - Recent activity feed
 */

export interface Solve {
    teamId: string;
    teamName: string;
    challengeId: string;
    challengeName: string;
    category: string;
    points: number;
    timestamp: number;
}

export interface Team {
    id: string;
    name: string;
    score: number;
    solves: Solve[];
    lastActivity: number;
}

export interface ScoreboardState {
    teams: Map<string, Team>;
    recentSolves: Solve[];
    lastUpdate: number;
}

export class ScoreboardTracker {
    private state: ScoreboardState;
    private listeners: Array<(data: any) => void> = [];

    constructor() {
        this.state = {
            teams: new Map(),
            recentSolves: [],
            lastUpdate: Date.now(),
        };
    }

    recordSolve(solve: Solve) {
        // Update team
        let team = this.state.teams.get(solve.teamId);
        if (!team) {
            team = {
                id: solve.teamId,
                name: solve.teamName,
                score: 0,
                solves: [],
                lastActivity: solve.timestamp,
            };
            this.state.teams.set(solve.teamId, team);
        }

        team.score += solve.points;
        team.solves.push(solve);
        team.lastActivity = solve.timestamp;

        // Update recent solves
        this.state.recentSolves.unshift(solve);
        if (this.state.recentSolves.length > 50) {
            this.state.recentSolves = this.state.recentSolves.slice(0, 50);
        }

        this.state.lastUpdate = Date.now();
        this.emit('solve', solve);
    }

    getLeaderboard(): Team[] {
        return Array.from(this.state.teams.values())
            .sort((a, b) => b.score - a.score);
    }

    getTeamRank(teamId: string): number {
        const leaderboard = this.getLeaderboard();
        return leaderboard.findIndex(t => t.id === teamId) + 1;
    }

    getRecentSolves(limit: number = 10): Solve[] {
        return this.state.recentSolves.slice(0, limit);
    }

    getCategoryStats(): Map<string, { solves: number; totalPoints: number }> {
        const stats = new Map<string, { solves: number; totalPoints: number }>();

        for (const team of this.state.teams.values()) {
            for (const solve of team.solves) {
                const existing = stats.get(solve.category) || { solves: 0, totalPoints: 0 };
                existing.solves++;
                existing.totalPoints += solve.points;
                stats.set(solve.category, existing);
            }
        }

        return stats;
    }

    on(event: string, callback: (data: any) => void) {
        this.listeners.push(callback);
    }

    private emit(event: string, data: any) {
        for (const fn of this.listeners) fn({ event, data });
    }
}
