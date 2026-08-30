/**
 * Flag format validation and comparison from ctfcli patterns.
 */
export interface FlagFormat {
    prefix: string;
    suffix: string;
    pattern: RegExp;
    name: string;
}

export const STANDARD_FORMATS: FlagFormat[] = [
    { prefix: 'flag{', suffix: '}', pattern: /^flag\{[^}]+\}$/i, name: 'Standard' },
    { prefix: 'CTF{', suffix: '}', pattern: /^ctf\{[^}]+\}$/i, name: 'CTF' },
    { prefix: 'FLAG{', suffix: '}', pattern: /^FLAG\{[^}]+\}$/i, name: 'FLAG' },
    { prefix: 'f1ag{', suffix: '}', pattern: /^f1ag\{[^}]+\}$/i, name: 'f1ag' },
];

const LEET_MAP: Record<string, string[]> = {
    'a': ['4', '@'], 'e': ['3'], 'i': ['1', '!'], 'o': ['0'],
    's': ['5', '$'], 't': ['7'], 'l': ['1'], 'g': ['9'],
};

function normalizeLeetspeak(input: string): string {
    let result = input.toLowerCase();
    for (const [char, replacements] of Object.entries(LEET_MAP)) {
        for (const rep of replacements) {
            result = result.split(rep).join(char);
        }
    }
    return result;
}

export function isValidFlagFormat(submitted: string, challengeFlagFormat?: string): boolean {
    const trimmed = submitted.trim();
    if (challengeFlagFormat) {
        return trimmed.toLowerCase() === challengeFlagFormat.toLowerCase();
    }
    return STANDARD_FORMATS.some(f => f.pattern.test(trimmed));
}

export function compareFlags(submitted: string, expected: string): { correct: boolean; reason: string } {
    const cleanSubmitted = submitted.trim();
    const cleanExpected = expected.trim();

    if (cleanSubmitted === cleanExpected) {
        return { correct: true, reason: 'Exact match' };
    }
    if (cleanSubmitted.toLowerCase() === cleanExpected.toLowerCase()) {
        return { correct: true, reason: 'Case-insensitive match' };
    }
    const norm1 = normalizeLeetspeak(cleanSubmitted);
    const norm2 = normalizeLeetspeak(cleanExpected);
    if (norm1 === norm2) {
        return { correct: true, reason: 'Leetspeak match' };
    }
    if (norm1.toLowerCase() === norm2.toLowerCase()) {
        return { correct: true, reason: 'Leetspeak + case-insensitive match' };
    }
    return { correct: false, reason: 'Flags do not match' };
}

export function extractFlagContent(submitted: string): string {
    const match = submitted.match(/\{([^}]+)\}/);
    return match ? match[1] : submitted;
}

export function calculateScore(
    basePoints: number,
    hintsUsed: number,
    hintCost: number,
    solveTimeSeconds: number,
    timeLimit: number,
    firstBlood: boolean,
): number {
    let score = basePoints;
    score -= hintsUsed * hintCost;
    if (timeLimit > 0 && solveTimeSeconds > 0) {
        const timeBonus = Math.max(0, 1 - solveTimeSeconds / timeLimit);
        score = Math.round(score * (0.7 + 0.3 * timeBonus));
    }
    if (firstBlood) {
        score = Math.round(score * 1.1);
    }
    return Math.max(10, score);
}
