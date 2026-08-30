/**
 * Flag submission tracking from dotflag — flag status management.
 */
export interface FlagSubmission {
    flag: string;
    challengeId: string;
    teamId: string;
    timestamp: number;
    status: 'pending' | 'accepted' | 'rejected' | 'duplicate' | 'expired';
    response?: string;
    points?: number;
}

export interface FlagStats {
    totalSubmissions: number;
    accepted: number;
    rejected: number;
    duplicates: number;
    accuracy: number;
    pointsEarned: number;
}

const submissions: FlagSubmission[] = [];

export function submitFlag(flag: string, challengeId: string, teamId: string): FlagSubmission {
    const existing = submissions.find(s => s.flag === flag && s.challengeId === challengeId);
    const submission: FlagSubmission = {
        flag, challengeId, teamId, timestamp: Date.now(),
        status: existing ? 'duplicate' : 'accepted',
    };
    submissions.push(submission);
    return submission;
}

export function getTeamStats(teamId: string): FlagStats {
    const teamSubmissions = submissions.filter(s => s.teamId === teamId);
    const accepted = teamSubmissions.filter(s => s.status === 'accepted');
    const rejected = teamSubmissions.filter(s => s.status === 'rejected');
    const duplicates = teamSubmissions.filter(s => s.status === 'duplicate');
    return {
        totalSubmissions: teamSubmissions.length, accepted: accepted.length,
        rejected: rejected.length, duplicates: duplicates.length,
        accuracy: teamSubmissions.length > 0 ? accepted.length / teamSubmissions.length : 0,
        pointsEarned: accepted.reduce((sum, s) => sum + (s.points || 0), 0),
    };
}

export function getRecentSubmissions(limit: number = 20): FlagSubmission[] {
    return submissions.slice(-limit);
}
