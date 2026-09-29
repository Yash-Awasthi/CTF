/**
 * Create a real event: the event row (READY, so players can reach the waiting
 * room), one participant per roll number with a random access code, and the 30
 * challenge rows mirrored from the challenge registry.
 *
 *   pnpm event:create --slug spring-2026 --name "Case Files — Spring 2026" \
 *     --hours 3 --rolls 25115000-25115059 [--apply local|remote]
 *   (or --roster rolls.txt, one roll number per line)
 *
 * Writes events/<slug>/setup.sql and events/<slug>/access-codes.csv. The CSV is
 * the only copy of the codes: hand each player their line, keep it private.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { getAllChallenges } from '../src/lib/challenges/registry';
import { hashAccessCode } from '../src/lib/auth/credentials';
import { CODENAME_POOL } from '../challenges/shared/codenames';
import { MAX_EVENT_DURATION_SECONDS } from '../src/lib/event/constants';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : undefined;
}

function fail(msg: string): never {
	console.error(`create-event: ${msg}`);
	process.exit(1);
}

const sql = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

function newCode(): string {
	const chars = Array.from({ length: 12 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
	return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

function readRolls(): number[] {
	const range = arg('rolls');
	const file = arg('roster');
	let rolls: number[];
	if (range) {
		const m = /^(\d+)-(\d+)$/.exec(range);
		if (!m) fail('--rolls must look like 25115000-25115059');
		const [a, b] = [Number(m[1]), Number(m[2])];
		if (b < a) fail('--rolls end must not be below its start');
		rolls = Array.from({ length: b - a + 1 }, (_, i) => a + i);
	} else if (file) {
		rolls = readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(Number);
	} else {
		fail('give --rolls START-END or --roster FILE');
	}
	if (rolls.some((r) => !Number.isSafeInteger(r) || r <= 0)) fail('roll numbers must be positive integers');
	if (new Set(rolls).size !== rolls.length) fail('roll numbers must be unique');
	// Codenames are a fixed 200-name permutation; more players would share one.
	if (rolls.length > CODENAME_POOL.length) fail(`at most ${CODENAME_POOL.length} participants per event`);
	return rolls;
}

async function main() {
	const slug = arg('slug') ?? fail('--slug is required');
	if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(slug)) fail('--slug must be lowercase letters, digits and dashes');
	const name = arg('name') ?? fail('--name is required');
	const hours = Number(arg('hours') ?? '3');
	const duration = Math.round(hours * 3600);
	if (!(duration > 0 && duration <= MAX_EVENT_DURATION_SECONDS)) fail(`--hours must be between 0 and ${MAX_EVENT_DURATION_SECONDS / 3600}`);
	const apply = arg('apply');
	if (apply && apply !== 'local' && apply !== 'remote') fail('--apply must be local or remote');
	const rolls = readRolls();

	const dir = join('events', slug);
	if (existsSync(join(dir, 'access-codes.csv'))) fail(`${dir}/access-codes.csv exists; refusing to issue a second set of codes`);
	mkdirSync(dir, { recursive: true });

	const codes = rolls.map((roll) => ({ roll, code: newCode() }));
	const eventId = `(SELECT id FROM events WHERE slug = ${sql(slug)})`;
	const lines = [
		`INSERT INTO events (name, slug, state, duration_seconds, secret_version, created_at) VALUES (${sql(name)}, ${sql(slug)}, 'READY', ${duration}, 'v1', unixepoch());`,
	];
	for (const { roll, code } of codes) {
		lines.push(`INSERT INTO participants (event_id, roll_number, access_code_hash, current_challenge, score, status, created_at) VALUES (${eventId}, ${roll}, ${sql(await hashAccessCode(code))}, 1, 0, 'registered', unixepoch());`);
	}
	for (const { metadata: m } of getAllChallenges()) {
		lines.push(`INSERT INTO challenges (event_id, slot, tier, base_points, attribution_enabled, prerequisites, created_at) VALUES (${eventId}, ${m.slot}, ${sql(m.tier)}, ${m.basePoints}, ${m.attributionEnabled ? 1 : 0}, NULL, unixepoch());`);
	}
	writeFileSync(join(dir, 'setup.sql'), lines.join('\n') + '\n');
	writeFileSync(join(dir, 'access-codes.csv'), ['roll_number,access_code', ...codes.map((c) => `${c.roll},${c.code}`)].join('\n') + '\n');
	console.log(`Wrote ${dir}/setup.sql and ${dir}/access-codes.csv (${codes.length} participants, ${getAllChallenges().length} challenges).`);

	if (apply) {
		const wrangler = createRequire(import.meta.url).resolve('wrangler/bin/wrangler.js');
		execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'case-files-db', `--${apply}`, '--file', join(dir, 'setup.sql')], { stdio: 'inherit' });
		console.log(`Applied to the ${apply} database. Players log in at /${slug}/login with their roll number and access code.`);
	}
}

main().catch((e) => fail((e as Error).message));
