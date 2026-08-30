/**
 * P&KU State Machine — Extracted from P&KU Website patterns.
 *
 * Database-as-state-machine pattern:
 * - All state computed from operations
 * - Operations stored in DB, state in memory
 * - Flexible state transitions
 * - Activity-based challenge management
 */

export interface Operation {
    id: string;
    type: string;
    timestamp: number;
    userId: string;
    data: Record<string, unknown>;
    processed: boolean;
}

export interface StateSnapshot {
    challenges: Map<string, ChallengeState>;
    teams: Map<string, TeamState>;
    users: Map<string, UserState>;
    timestamp: number;
}

export interface ChallengeState {
    id: string;
    title: string;
    area: string;
    points: number;
    solvedBy: string[];
    unlockedBy: string[];
    status: 'locked' | 'unlocked' | 'solved';
}

export interface TeamState {
    id: string;
    name: string;
    members: string[];
    score: number;
    solves: string[];
    hintsUsed: number;
}

export interface UserState {
    id: string;
    name: string;
    teamId?: string;
    solvedChallenges: string[];
    isActive: boolean;
}

export class PnkuStateMachine {
    private operations: Operation[] = [];
    private state: StateSnapshot;
    private listeners: Array<(state: StateSnapshot) => void> = [];

    constructor() {
        this.state = {
            challenges: new Map(),
            teams: new Map(),
            users: new Map(),
            timestamp: Date.now(),
        };
    }

    submitOperation(op: Omit<Operation, 'id' | 'timestamp' | 'processed'>): string {
        const operation: Operation = {
            ...op,
            id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: Date.now(),
            processed: false,
        };
        this.operations.push(operation);
        this.recomputeState();
        return operation.id;
    }

    recomputeState(): void {
        const newState: StateSnapshot = {
            challenges: new Map(),
            teams: new Map(),
            users: new Map(),
            timestamp: Date.now(),
        };

        for (const op of this.operations) {
            this.applyOperation(newState, op);
            op.processed = true;
        }

        this.state = newState;
        this.notifyListeners();
    }

    private applyOperation(state: StateSnapshot, op: Operation): void {
        switch (op.type) {
            case 'register_user': {
                state.users.set(op.userId, {
                    id: op.userId,
                    name: op.data.name as string,
                    solvedChallenges: [],
                    isActive: true,
                });
                break;
            }
            case 'create_team': {
                const teamId = op.data.teamId as string;
                state.teams.set(teamId, {
                    id: teamId,
                    name: op.data.name as string,
                    members: [op.userId],
                    score: 0,
                    solves: [],
                    hintsUsed: 0,
                });
                break;
            }
            case 'join_team': {
                const teamId = op.data.teamId as string;
                const team = state.teams.get(teamId);
                const user = state.users.get(op.userId);
                if (team && user && !team.members.includes(op.userId)) {
                    team.members.push(op.userId);
                    user.teamId = teamId;
                }
                break;
            }
            case 'solve_challenge': {
                const challengeId = op.data.challengeId as string;
                const challenge = state.challenges.get(challengeId);
                if (challenge && !challenge.solvedBy.includes(op.userId)) {
                    challenge.solvedBy.push(op.userId);
                    challenge.status = 'solved';

                    const user = state.users.get(op.userId);
                    if (user) {
                        user.solvedChallenges.push(challengeId);
                    }

                    if (user?.teamId) {
                        const team = state.teams.get(user.teamId);
                        if (team && !team.solves.includes(challengeId)) {
                            team.solves.push(challengeId);
                            team.score += challenge.points;
                        }
                    }
                }
                break;
            }
            case 'unlock_challenge': {
                const challengeId = op.data.challengeId as string;
                const challenge = state.challenges.get(challengeId);
                if (challenge && !challenge.unlockedBy.includes(op.userId)) {
                    challenge.unlockedBy.push(op.userId);
                    if (challenge.status === 'locked') {
                        challenge.status = 'unlocked';
                    }
                }
                break;
            }
            case 'use_hint': {
                const user = state.users.get(op.userId);
                if (user?.teamId) {
                    const team = state.teams.get(user.teamId);
                    if (team) {
                        team.hintsUsed++;
                    }
                }
                break;
            }
        }
    }

    getState(): StateSnapshot {
        return this.state;
    }

    getOperations(): Operation[] {
        return [...this.operations];
    }

    getLeaderboard(): TeamState[] {
        return Array.from(this.state.teams.values())
            .sort((a, b) => b.score - a.score);
    }

    getChallengeStats(challengeId: string): { solves: number; hintsUsed: number } | null {
        const challenge = this.state.challenges.get(challengeId);
        if (!challenge) return null;

        let hintsUsed = 0;
        for (const team of this.state.teams.values()) {
            if (team.solves.includes(challengeId)) {
                hintsUsed += team.hintsUsed;
            }
        }

        return { solves: challenge.solvedBy.length, hintsUsed };
    }

    subscribe(listener: (state: StateSnapshot) => void): () => void {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0) this.listeners.splice(idx, 1);
        };
    }

    private notifyListeners(): void {
        for (const fn of this.listeners) fn(this.state);
    }
}
