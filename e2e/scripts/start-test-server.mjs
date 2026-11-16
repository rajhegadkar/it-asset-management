/**
 * Starts an isolated copy of the app for the UI tests:
 *  - builds the frontend (so the backend serves the real production bundle),
 *  - creates a fresh SQLite database (backend/prisma/e2e-test.db) and seeds demo data,
 *  - starts the backend on port 5099 with e-mail mocked, scheduler off and rate limits off.
 * Your normal dev.db is never touched.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const dbFile = path.join(backend, 'prisma', 'e2e-test.db');
const PORT = process.env.E2E_PORT || '5099';

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT,
  DATABASE_URL: `file:${dbFile.replace(/\\/g, '/')}`,
  EMAIL_MOCK: 'true',
  SCHEDULER_ENABLED: 'false',
  DISABLE_RATE_LIMIT: 'true',
  BACKUP_DIR: 'backups-e2e',
};

function run(cmd, cwd) {
  console.log(`[e2e] ${cmd}`);
  const r = spawnSync(cmd, { cwd, env, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`[e2e] command failed: ${cmd}`);
    process.exit(r.status || 1);
  }
}

if (process.env.E2E_SKIP_BUILD !== 'true') run('npx vite build', frontend);

for (const f of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) if (existsSync(f)) rmSync(f);
rmSync(path.join(backend, 'backups-e2e'), { recursive: true, force: true });
run('npx prisma db push --skip-generate', backend);
run('npx tsx prisma/seed.ts', backend);
run(`node ${JSON.stringify(path.join(here, 'legacy-config.cjs'))}`, backend);

console.log(`[e2e] starting backend on http://localhost:${PORT}`);
const server = spawn('npx tsx src/server.ts', { cwd: backend, env, stdio: 'inherit', shell: true });
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
