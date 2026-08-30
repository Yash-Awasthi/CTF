/**
 * CTFDump Extractor — Extracted from CTFDump patterns.
 *
 * CTF platform data extraction with:
 * - Challenge metadata parsing
 * - File downloading
 * - Category organization
 * - Multi-platform support
 */

export interface ChallengeData {
    name: string;
    url: string;
    category: string;
    description: string;
    value: number;
    files: string[];
    hints: string[];
    solvedBy: number;
}

export interface PlatformConfig {
    name: string;
    baseUrl: string;
    loginPath: string;
    challengesPath: string;
    authMethod: 'cookie' | 'token' | 'basic';
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
    ctfd: {
        name: 'CTFd',
        baseUrl: '',
        loginPath: '/login',
        challengesPath: '/api/v1/challenges',
        authMethod: 'token',
    },
    picoctf: {
        name: 'picoCTF',
        baseUrl: '',
        loginPath: '/login',
        challengesPath: '/api/problems',
        authMethod: 'cookie',
    },
    rootthebox: {
        name: 'RootTheBox',
        baseUrl: '',
        loginPath: '/login',
        challengesPath: '/api/challenges',
        authMethod: 'cookie',
    },
};

export class CTFDumpExtractor {
    private platform: PlatformConfig;
    private session: Map<string, string> = new Map();

    constructor(platformName: string) {
        this.platform = PLATFORM_CONFIGS[platformName] || PLATFORM_CONFIGS.ctfd;
    }

    setCredentials(key: string, value: string) {
        this.session.set(key, value);
    }

    parseChallenge(html: string): ChallengeData {
        const name = this.extractBetween(html, '<h4>', '</h4>') || 'Unknown';
        const description = this.extractBetween(html, '<p>', '</p>') || '';
        const value = parseInt(this.extractBetween(html, 'value="', '"') || '0', 10);
        const category = this.extractBetween(html, 'category="', '"') || 'General';

        const fileRegex = /https?:\/\/[^\s"'<>]+\.(?:zip|txt|png|jpg|pdf|py|js)/gi;
        const files = (html.match(fileRegex) || []);

        return {
            name,
            url: '',
            category,
            description,
            value,
            files,
            hints: [],
            solvedBy: 0,
        };
    }

    parseChallenges(json: string): ChallengeData[] {
        try {
            const data = JSON.parse(json);
            const challenges = data.data || data.challenges || [];
            return challenges.map((c: any) => ({
                name: c.name || 'Unknown',
                url: c.url || '',
                category: c.category || 'General',
                description: c.description || '',
                value: c.value || c.points || 0,
                files: c.files || [],
                hints: c.hints || [],
                solvedBy: c.solves || 0,
            }));
        } catch {
            return [];
        }
    }

    categorize(challenges: ChallengeData[]): Map<string, ChallengeData[]> {
        const categories = new Map<string, ChallengeData[]>();
        for (const challenge of challenges) {
            const cat = challenge.category;
            if (!categories.has(cat)) {
                categories.set(cat, []);
            }
            categories.get(cat)!.push(challenge);
        }
        return categories;
    }

    filterByDifficulty(challenges: ChallengeData[], maxPoints: number): ChallengeData[] {
        return challenges.filter(c => c.value <= maxPoints);
    }

    sortByValue(challenges: ChallengeData[], descending: boolean = true): ChallengeData[] {
        return [...challenges].sort((a, b) => descending ? b.value - a.value : a.value - b.value);
    }

    generateManifest(challenges: ChallengeData[]): string {
        const lines = [
            '# CTF Challenge Manifest',
            '',
            `Generated: ${new Date().toISOString()}`,
            `Total Challenges: ${challenges.length}`,
            '',
            '## Categories',
            '',
        ];

        const categories = this.categorize(challenges);
        for (const [cat, chals] of categories) {
            lines.push(`### ${cat} (${chals.length})`);
            for (const c of chals) {
                lines.push(`- **${c.name}** (${c.value} pts) — ${c.description.substring(0, 80)}...`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    private extractBetween(text: string, start: string, end: string): string {
        const startIdx = text.indexOf(start);
        if (startIdx === -1) return '';
        const fromStart = startIdx + start.length;
        const endIdx = text.indexOf(end, fromStart);
        if (endIdx === -1) return '';
        return text.substring(fromStart, endIdx);
    }
}
