/**
 * Q25 — 1963
 *
 * An old photograph has surfaced — and "Daniel Reyes" appears in it, decades
 * before the 2015 Daniel could exist. Multi-source verification (newspaper
 * date, print stock manufacture date, EXIF) all agree: 1963. This destroys
 * the "means and identity" pillar of Q24's conviction.
 * Fixed answer: 1963.
 *
 * Q29 contribution: the photograph reverse carries an archival mark "TC-III-W"
 *   (THE CONTINUITY, Cycle 3, Witness — secondary anomaly).
 * Mutable: no
 */
import { exactMatch } from '../../src/lib/challenges/validators';
import { ALPHABETS } from '../../src/lib/crypto/constants';
import type { ChallengeModule, GeneratedChallenge } from '../../src/lib/challenges/types';

interface Public {
	prompt: string;
	token: string;
}
interface Private {
	answer: string;
}

const challenge: ChallengeModule<Public, Private> = {
	metadata: {
		slot: 25,
		key: '1963',
		title: '1963',
		tier: 'hard',
		basePoints: 300,
		attributionEnabled: false,
	},
	hints: [
		{
			order: 1,
			text: 'Check every date source independently — newspaper date, print stock manufacture range, and EXIF. They should agree, and they do.',
		},
		{
			order: 2,
			text: 'A photograph from 1963 cannot contain the same person who was operating in 2015. The date is confirmed by three independent sources.',
		},
	],

	async generate(ctx): Promise<GeneratedChallenge<Public, Private>> {
		const token = await ctx.rng.string(8, ALPHABETS.upper);

		const prompt = [
			'RECOVERED PHOTOGRAPH — PROVENANCE QUERY',
			'',
			'Found in the Blackwood Bureau\'s own suppressed annex — not from Daniel\'s archive.',
			'Four people. One is labelled \'D. REYES\' in handwriting on the reverse.',
			'He appears to be in his mid-30s.',
			'',
			'THREE INDEPENDENT DATING SOURCES:',
			'',
			'1. NEWSPAPER VISIBLE IN PHOTOGRAPH:',
			'   Masthead: Caldwell Evening Chronicle',
			'   Date line: Thursday, 14 November 1963',
			'',
			'2. PRINT STOCK ANALYSIS:',
			'   Paper: Ferrania photographic bromide stock (manufactured 1958–1971)',
			'   Chemical aging profile: consistent with 1960–1965 exposure',
			'',
			'3. EXIF METADATA (negative scan, 2008):',
			'   DateTimeOriginal: 1963:11:14 (transcribed from physical negative)',
			'   ScannerNote: \'Original negative dated Nov 1963 — hand-marked\'',
			'',
			'REVERSE OF PHOTOGRAPH:',
			'   \'D. REYES — estate contact\'  ·  Archival stamp: TC-III-W',
			'   [TC-III-W is not a Blackwood format — origin unknown]',
			'',
			'If this D. REYES was mid-30s in 1963, he would be in his late 80s in 2015.',
			'He is not.',
			'',
			'What year does this photograph date to?',
		].join('\n');

		return {
			publicData: { prompt, token },
			privateData: { answer: '1963' },
		};
	},

	validate(instance, normalizedAnswer) {
		return exactMatch(normalizedAnswer, instance.privateData.answer);
	},
};

export default challenge;
