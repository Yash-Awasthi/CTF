// Privacy scrub over the built static replay output. Fails if prohibited
// live-event data leaked. Reads dev secret VALUES from .dev.vars to also catch
// literal secret leakage. Unmasked roll numbers are intentional (allowed).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'EVENT_SECRET','ADMIN_SECRET','RATE_LIMIT_SECRET','token_hash','tokenHash',
  'ip_hash','ipHash','ownershipMap','matchedParticipantId','anti_cheat','antiCheat',
  'admin_actions','privateData','participantSeed','challengeSeed','attributionSeed','dev-only',
];
let secretValues = [];
if (existsSync('.dev.vars')) {
  for (const line of readFileSync('.dev.vars','utf8').split('\n')) {
    const m = line.match(/^[A-Z_]+="?([^"\n]+)"?/);
    if (m) secretValues.push(m[1]);
  }
}
const roots = ['dist/client/replay','public/replay'].filter(existsSync);
function walk(dir){ const out=[]; for(const f of readdirSync(dir)){ const p=join(dir,f); statSync(p).isDirectory()?out.push(...walk(p)):out.push(p);} return out; }
const files = roots.flatMap(walk);
const hits = [];
for (const f of files) {
  const c = readFileSync(f,'utf8');
  for (const p of FORBIDDEN) if (c.includes(p)) hits.push(`${f}: ${p}`);
  for (const s of secretValues) if (s && c.includes(s)) hits.push(`${f}: <secret-value>`);
}
if (hits.length) { console.error('PRIVACY SCRUB FAILED:\n' + hits.join('\n')); process.exit(1); }
console.log(`Privacy scrub OK — scanned ${files.length} static replay files, no prohibited data.`);
