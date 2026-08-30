"""
Quiz management from classquiz — quiz creation, scoring, real-time play.
"""
export interface QuizQuestion {
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'text' | 'poll';
    options?: string[];
    correctAnswer?: string | number;
    timeLimit: number; // seconds
    points: number;
}

export interface Quiz {
    id: string;
    title: string;
    description: string;
    questions: QuizQuestion[];
    createdBy: string;
    createdAt: number;
    isPublic: boolean;
    maxPlayers: number;
    gameMode: 'classic' | 'fastest_first' | 'zero_to_hero';
}

export interface PlayerAnswer {
    playerId: string;
    questionId: string;
    answer: string | number;
    timeSpent: number; // milliseconds
    isCorrect: boolean;
    pointsEarned: number;
}

export interface GameSession {
    quizId: string;
    pin: string;
    players: Player[];
    currentQuestion: number;
    state: 'lobby' | 'question' | 'results' | 'finished';
    answers: PlayerAnswer[];
    startedAt: number;
}

export interface Player {
    id: string;
    name: string;
    score: number;
    streak: number;
    joinedAt: number;
}

export interface LeaderboardEntry {
    rank: number;
    playerId: string;
    playerName: string;
    totalScore: number;
    correctAnswers: number;
    avgResponseTime: number;
}

const quizzes: Map<string, Quiz> = new Map();
const sessions: Map<string, GameSession> = new Map();

function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createQuiz(data: Omit<Quiz, 'id' | 'createdAt'>): Quiz {
    const quiz: Quiz = { ...data, id: generateId(), createdAt: Date.now() };
    quizzes.set(quiz.id, quiz);
    return quiz;
}

export function createGameSession(quizId: string): GameSession | null {
    const quiz = quizzes.get(quizId);
    if (!quiz) return null;
    const session: GameSession = {
        quizId,
        pin: generatePin(),
        players: [],
        currentQuestion: 0,
        state: 'lobby',
        answers: [],
        startedAt: Date.now(),
    };
    sessions.set(session.pin, session);
    return session;
}

export function joinGame(pin: string, playerName: string): Player | null {
    const session = sessions.get(pin);
    if (!session || session.state !== 'lobby') return null;
    if (session.players.length >= 50) return null;
    const player: Player = {
        id: generateId(),
        name: playerName,
        score: 0,
        streak: 0,
        joinedAt: Date.now(),
    };
    session.players.push(player);
    return player;
}

export function submitAnswer(pin: string, playerId: string, questionId: string, answer: string | number, timeSpent: number): PlayerAnswer | null {
    const session = sessions.get(pin);
    if (!session) return null;
    const quiz = quizzes.get(session.quizId);
    if (!quiz) return null;
    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return null;

    const isCorrect = String(answer).toLowerCase() === String(question.correctAnswer).toLowerCase();
    const timeBonus = Math.max(0, 1 - timeSpent / (question.timeLimit * 1000));
    const pointsEarned = isCorrect ? Math.round(question.points * (0.5 + 0.5 * timeBonus)) : 0;

    const playerAnswer: PlayerAnswer = { playerId, questionId, answer, timeSpent, isCorrect, pointsEarned };
    session.answers.push(playerAnswer);

    const player = session.players.find(p => p.id === playerId);
    if (player) {
        player.score += pointsEarned;
        if (isCorrect) player.streak++; else player.streak = 0;
    }

    return playerAnswer;
}

export function advanceQuestion(pin: string): QuizQuestion | null {
    const session = sessions.get(pin);
    if (!session) return null;
    const quiz = quizzes.get(session.quizId);
    if (!quiz) return null;

    session.currentQuestion++;
    if (session.currentQuestion >= quiz.questions.length) {
        session.state = 'finished';
        return null;
    }
    session.state = 'question';
    return quiz.questions[session.currentQuestion];
}

export function getLeaderboard(pin: string): LeaderboardEntry[] {
    const session = sessions.get(pin);
    if (!session) return [];

    const playerStats: Record<string, { score: number; correct: number; totalTime: number; count: number }> = {};
    for (const answer of session.answers) {
        if (!playerStats[answer.playerId]) playerStats[answer.playerId] = { score: 0, correct: 0, totalTime: 0, count: 0 };
        const s = playerStats[answer.playerId];
        s.count++;
        s.totalTime += answer.timeSpent;
        if (answer.isCorrect) s.correct++;
    }

    const entries: LeaderboardEntry[] = session.players.map(p => {
        const stats = playerStats[p.id] || { score: 0, correct: 0, totalTime: 0, count: 0 };
        return {
            rank: 0,
            playerId: p.id,
            playerName: p.name,
            totalScore: p.score,
            correctAnswers: stats.correct,
            avgResponseTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        };
    });

    entries.sort((a, b) => b.totalScore - a.totalScore);
    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries;
}
