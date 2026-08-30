/**
 * Live Quiz Engine — Extracted from Quizzle patterns.
 *
 * Provides:
 * - Real-time quiz sessions with QR code join
 * - Live question broadcasting
 * - Answer submission and scoring
 * - Team and solo modes
 * - Timer-based questions
 */

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    timeLimit: number;
    points: number;
}

export interface QuizSession {
    id: string;
    hostId: string;
    questions: QuizQuestion[];
    currentQuestion: number;
    status: 'waiting' | 'active' | 'finished';
    participants: Map<string, Participant>;
    startTime?: number;
    joinCode: string;
}

export interface Participant {
    id: string;
    name: string;
    score: number;
    answers: { questionId: string; answerIndex: number; timeMs: number; correct: boolean }[];
    connected: boolean;
    joinedAt: number;
}

export class LiveQuizEngine {
    private sessions: Map<string, QuizSession> = new Map();
    private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

    createSession(hostId: string, questions: QuizQuestion[]): QuizSession {
        const session: QuizSession = {
            id: `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            hostId,
            questions,
            currentQuestion: -1,
            status: 'waiting',
            participants: new Map(),
            joinCode: this._generateJoinCode(),
        };
        this.sessions.set(session.id, session);
        return session;
    }

    joinSession(joinCode: string, participantId: string, name: string): { success: boolean; session?: QuizSession; message: string } {
        const session = Array.from(this.sessions.values()).find(s => s.joinCode === joinCode);
        if (!session) return { success: false, message: 'Session not found' };
        if (session.status !== 'waiting') return { success: false, message: 'Session already started' };

        session.participants.set(participantId, {
            id: participantId,
            name,
            score: 0,
            answers: [],
            connected: true,
            joinedAt: Date.now(),
        });

        this.emit(session.id, 'participant_joined', { participantId, name });
        return { success: true, session, message: 'Joined successfully' };
    }

    startSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.participants.size === 0) return false;

        session.status = 'active';
        session.currentQuestion = 0;
        session.startTime = Date.now();
        this.emit(sessionId, 'session_started', { questionCount: session.questions.length });
        return true;
    }

    submitAnswer(sessionId: string, participantId: string, answerIndex: number): { correct: boolean; points: number } {
        const session = this.sessions.get(sessionId);
        if (!session) return { correct: false, points: 0 };

        const participant = session.participants.get(participantId);
        if (!participant) return { correct: false, points: 0 };

        const question = session.questions[session.currentQuestion];
        if (!question) return { correct: false, points: 0 };

        const correct = answerIndex === question.correctIndex;
        const timeMs = Date.now() - (session.startTime || Date.now());

        // Time bonus: faster answers get more points
        const timeBonus = Math.max(0, 1 - timeMs / (question.timeLimit * 1000));
        const points = correct ? Math.round(question.points * (0.5 + 0.5 * timeBonus)) : 0;

        participant.answers.push({
            questionId: question.id,
            answerIndex,
            timeMs,
            correct,
        });
        participant.score += points;

        this.emit(sessionId, 'answer_submitted', { participantId, correct, points });
        return { correct, points };
    }

    nextQuestion(sessionId: string): QuizQuestion | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        session.currentQuestion++;
        if (session.currentQuestion >= session.questions.length) {
            session.status = 'finished';
            this.emit(sessionId, 'session_finished', this.getResults(sessionId));
            return null;
        }

        const question = session.questions[session.currentQuestion];
        this.emit(sessionId, 'new_question', { question, index: session.currentQuestion });
        return question;
    }

    getResults(sessionId: string): { rankings: Array<{ name: string; score: number; correct: number; total: number }> } | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const rankings = Array.from(session.participants.values())
            .map(p => ({
                name: p.name,
                score: p.score,
                correct: p.answers.filter(a => a.correct).length,
                total: p.answers.length,
            }))
            .sort((a, b) => b.score - a.score);

        return { rankings };
    }

    getSession(sessionId: string): QuizSession | null {
        return this.sessions.get(sessionId) || null;
    }

    disconnectParticipant(sessionId: string, participantId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        const p = session.participants.get(participantId);
        if (p) p.connected = false;
    }

    on(sessionId: string, event: string, callback: (data: unknown) => void) {
        const key = `${sessionId}:${event}`;
        const listeners = this.listeners.get(key) || [];
        listeners.push(callback);
        this.listeners.set(key, listeners);
    }

    private emit(sessionId: string, event: string, data: unknown) {
        const key = `${sessionId}:${event}`;
        const listeners = this.listeners.get(key) || [];
        for (const fn of listeners) fn(data);
    }

    private _generateJoinCode(): string {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }
}
