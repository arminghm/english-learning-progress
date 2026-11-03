import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/add-session.mjs <session.json>');
  process.exit(1);
}

const dataPath = resolve('data/progress.json');
const progress = JSON.parse(await readFile(dataPath, 'utf8'));
const session = JSON.parse(await readFile(resolve(source), 'utf8'));
const skillIds = new Set(progress.skills.map((skill) => skill.id));

function requireText(key) {
  if (typeof session[key] !== 'string' || !session[key].trim()) {
    throw new Error(`${key} must be non-empty text`);
  }
}

for (const key of ['id', 'date', 'kind', 'topic', 'mode', 'summary', 'evidence', 'nextFocus']) requireText(key);
const parsedDate = new Date(`${session.date}T00:00:00Z`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== session.date) {
  throw new Error('date must be a valid YYYY-MM-DD date');
}
if (!['assessment', 'practice'].includes(session.kind)) throw new Error('kind must be assessment or practice');
if (!['audio', 'text'].includes(session.mode)) throw new Error('mode must be audio or text');
if (!Number.isInteger(session.minutes) || session.minutes < 1 || session.minutes > 240) {
  throw new Error('minutes must be an integer from 1 to 240');
}
if (progress.sessions.some((item) => item.id === session.id)) throw new Error('session id already exists');
if (session.ratings === null || typeof session.ratings !== 'object' || Array.isArray(session.ratings)) {
  throw new Error('ratings must be an object');
}
if (session.kind === 'practice' && Object.keys(session.ratings).length) {
  throw new Error('practice ratings must be empty; use assessment for independent evidence');
}
for (const [skill, score] of Object.entries(session.ratings)) {
  if (!skillIds.has(skill)) throw new Error(`unknown skill: ${skill}`);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error(`invalid rating for ${skill}`);
  if (session.mode === 'text' && ['fluency', 'pronunciation', 'listening'].includes(skill)) {
    throw new Error(`${skill} requires an audio session`);
  }
}
if (session.kind === 'assessment' && !Object.keys(session.ratings).length) {
  throw new Error('assessment needs at least one skill rating');
}

progress.sessions.push(session);
progress.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
await writeFile(dataPath, `${JSON.stringify(progress, null, 2)}\n`);
console.log(`Added ${session.id}. Total sessions: ${progress.sessions.length}`);
