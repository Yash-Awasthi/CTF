/**
 * CTF platform from ctfzone — challenge management and categorization.
 */
export interface CTFChallenge {
    id: string;
    title: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    points: number;
    description: string;
    author: string;
    tags: string[];
    attachments: string[];
    hints: string[];
    flag: string;
    solves: number;
    createdAt: number;
}

export interface CTFEvent {
    id: string;
    name: string;
    description: string;
    challenges: CTFChallenge[];
    startDate: number;
    endDate: number;
    maxTeams: number;
    format: 'jeopardy' | 'attack-defense' | 'king-of-the-hill';
}

const challenges: Map<string, CTFChallenge> = new Map();
const events: Map<string, CTFEvent> = new Map();

export function createChallenge(data: Omit<CTFChallenge, 'id' | 'solves' | 'createdAt'>): CTFChallenge {
    const challenge: CTFChallenge = { ...data, id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, solves: 0, createdAt: Date.now() };
    challenges.set(challenge.id, challenge);
    return challenge;
}

export function getChallengesByCategory(category: string): CTFChallenge[] {
    return Array.from(challenges.values()).filter(c => c.category === category);
}

export function getChallengesByDifficulty(difficulty: string): CTFChallenge[] {
    return Array.from(challenges.values()).filter(c => c.difficulty === difficulty);
}

export function getUnsolvedChallenges(solvedIds: Set<string>): CTFChallenge[] {
    return Array.from(challenges.values()).filter(c => !solvedIds.has(c.id));
}

export function createEvent(data: Omit<CTFEvent, 'id' | 'challenges'>): CTFEvent {
    const event: CTFEvent = { ...data, id: `evt_${Date.now()}`, challenges: [] };
    events.set(event.id, event);
    return event;
}

export function addChallengeToEvent(eventId: string, challenge: CTFChallenge): boolean {
    const event = events.get(eventId);
    if (!event) return false;
    event.challenges.push(challenge);
    return true;
}

export function getEventStats(eventId: string) {
    const event = events.get(eventId);
    if (!event) return null;
    return {
        totalChallenges: event.challenges.length,
        totalPoints: event.challenges.reduce((sum, c) => sum + c.points, 0),
        categories: [...new Set(event.challenges.map(c => c.category))],
        difficulties: [...new Set(event.challenges.map(c => c.difficulty))],
    };
}
