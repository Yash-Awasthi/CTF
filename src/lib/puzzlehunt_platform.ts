/**
 * Puzzlehunt Platform — Extracted from PuzzleSpring patterns.
 *
 * Provides:
 * - Team management with real-time sync
 * - Puzzle submission and answer checking
 * - Hint system with progressive reveals
 * - Hunt templates and archives
 * - Notification system
 */

export interface Puzzle {
    id: string;
    title: string;
    description: string;
    answer: string | RegExp;
    hints: Hint[];
    category: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
    points: number;
    unlockCondition?: string;
    solveCount: number;
    author: string;
}

export interface Hint {
    id: string;
    content: string;
    cost: number;
    unlockTime?: number;
}

export interface Team {
    id: string;
    name: string;
    members: TeamMember[];
    solves: Solve[];
    hintsUsed: number;
    totalScore: number;
    createdAt: number;
}

export interface TeamMember {
    userId: string;
    name: string;
    role: 'captain' | 'member';
    joinedAt: number;
}

export interface Solve {
    puzzleId: string;
    solvedBy: string;
    solvedAt: number;
    points: number;
    attempts: number;
}

export interface Submission {
    puzzleId: string;
    teamId: string;
    answer: string;
    submittedAt: number;
    correct: boolean;
    points?: number;
}

export interface Hunt {
    id: string;
    name: string;
    description: string;
    puzzles: Puzzle[];
    startTime?: number;
    endTime?: number;
    status: 'draft' | 'active' | 'ended' | 'archived';
    settings: HuntSettings;
}

export interface HuntSettings {
    maxTeamSize: number;
    hintCost: number;
    timeBonus: boolean;
    penaltyPerWrong: number;
    allowSolo: boolean;
}

export class PuzzlehuntPlatform {
    private hunts: Map<string, Hunt> = new Map();
    private teams: Map<string, Team> = new Map();
    private submissions: Map<string, Submission[]> = new Map();
    private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

    createHunt(config: {
        name: string;
        description: string;
        settings?: Partial<HuntSettings>;
    }): Hunt {
        const hunt: Hunt = {
            id: `hunt-${Date.now()}`,
            name: config.name,
            description: config.description,
            puzzles: [],
            status: 'draft',
            settings: {
                maxTeamSize: 5,
                hintCost: 50,
                timeBonus: true,
                penaltyPerWrong: 10,
                allowSolo: true,
                ...config.settings,
            },
        };
        this.hunts.set(hunt.id, hunt);
        return hunt;
    }

    addPuzzle(huntId: string, puzzle: Omit<Puzzle, 'id' | 'solveCount'>): Puzzle | null {
        const hunt = this.hunts.get(huntId);
        if (!hunt) return null;

        const fullPuzzle: Puzzle = {
            ...puzzle,
            id: `puzzle-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            solveCount: 0,
        };
        hunt.puzzles.push(fullPuzzle);
        return fullPuzzle;
    }

    createTeam(config: { name: string; captainId: string; captainName: string }): Team {
        const team: Team = {
            id: `team-${Date.now()}`,
            name: config.name,
            members: [{
                userId: config.captainId,
                name: config.captainName,
                role: 'captain',
                joinedAt: Date.now(),
            }],
            solves: [],
            hintsUsed: 0,
            totalScore: 0,
            createdAt: Date.now(),
        };
        this.teams.set(team.id, team);
        return team;
    }

    joinTeam(teamId: string, userId: string, userName: string): boolean {
        const team = this.teams.get(teamId);
        if (!team) return false;
        if (team.members.length >= 5) return false;

        team.members.push({
            userId,
            name: userName,
            role: 'member',
            joinedAt: Date.now(),
        });
        return true;
    }

    submitAnswer(
        puzzleId: string,
        teamId: string,
        answer: string,
        userId: string,
    ): { correct: boolean; points?: number; message: string } {
        const team = this.teams.get(teamId);
        if (!team) return { correct: false, message: 'Team not found' };

        let puzzle: Puzzle | null = null;
        for (const hunt of this.hunts.values()) {
            const found = hunt.puzzles.find(p => p.id === puzzleId);
            if (found) { puzzle = found; break; }
        }
        if (!puzzle) return { correct: false, message: 'Puzzle not found' };

        // Check if already solved
        if (team.solves.some(s => s.puzzleId === puzzleId)) {
            return { correct: false, message: 'Already solved' };
        }

        // Check answer
        const correct = this.checkAnswer(puzzle.answer, answer);

        const submission: Submission = {
            puzzleId,
            teamId,
            answer,
            submittedAt: Date.now(),
            correct,
        };
        const subs = this.submissions.get(puzzleId) || [];
        subs.push(submission);
        this.submissions.set(puzzleId, subs);

        if (correct) {
            const attempts = subs.filter(s => s.teamId === teamId).length;
            let points = puzzle.points;
            const penalty = (attempts - 1) * 10;
            points = Math.max(points - penalty, 10);

            team.solves.push({
                puzzleId,
                solvedBy: userId,
                solvedAt: Date.now(),
                points,
                attempts,
            });
            team.totalScore += points;
            puzzle.solveCount++;

            this.emit('solve', { puzzleId, teamId, points, userId });
            return { correct: true, points, message: `Correct! +${points} points` };
        }

        this.emit('wrong_answer', { puzzleId, teamId, userId });
        return { correct: false, message: 'Incorrect answer' };
    }

    requestHint(puzzleId: string, teamId: string): { hint: Hint | null; message: string } {
        const team = this.teams.get(teamId);
        if (!team) return { hint: null, message: 'Team not found' };

        let puzzle: Puzzle | null = null;
        for (const hunt of this.hunts.values()) {
            const found = hunt.puzzles.find(p => p.id === puzzleId);
            if (found) { puzzle = found; break; }
        }
        if (!puzzle) return { hint: null, message: 'Puzzle not found' };

        const usedHintCount = Math.floor(team.hintsUsed / 10);
        if (usedHintCount >= puzzle.hints.length) {
            return { hint: null, message: 'No more hints available' };
        }

        const hint = puzzle.hints[usedHintCount];
        team.hintsUsed++;
        team.totalScore = Math.max(0, team.totalScore - hint.cost);

        return { hint, message: `Hint revealed (-${hint.cost} points)` };
    }

    getLeaderboard(huntId?: string): Team[] {
        let teams = Array.from(this.teams.values());
        if (huntId) {
            const hunt = this.hunts.get(huntId);
            if (hunt) {
                const puzzleIds = new Set(hunt.puzzles.map(p => p.id));
                teams = teams.filter(t => t.solves.some(s => puzzleIds.has(s.puzzleId)));
            }
        }
        return teams.sort((a, b) => b.totalScore - a.totalScore);
    }

    private checkAnswer(expected: string | RegExp, submitted: string): boolean {
        const normalized = submitted.trim().toLowerCase();
        if (expected instanceof RegExp) {
            return expected.test(normalized);
        }
        return normalized === expected.trim().toLowerCase();
    }

    on(event: string, callback: (data: unknown) => void) {
        const listeners = this.listeners.get(event) || [];
        listeners.push(callback);
        this.listeners.set(event, listeners);
    }

    private emit(event: string, data: unknown) {
        const listeners = this.listeners.get(event) || [];
        for (const fn of listeners) fn(data);
    }
}
