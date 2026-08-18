// test/run-tests.js
// End-to-end test against a real running server + real tasks.db.
// Run with: npm test
// Deletes tasks.db before starting so runs are repeatable.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'tasks.db');
const BASE = 'http://localhost:3000';

let failures = 0;
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
  } else {
    console.log(`ok - ${label}`);
  }
}

function startServer() {
  const child = spawn('node', ['server.js'], { cwd: ROOT, stdio: 'pipe' });
  return child;
}

function waitForServer(retries = 20) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(`${BASE}/tasks`)
        .then(() => resolve())
        .catch(() => {
          if (--retries <= 0) return reject(new Error('server did not start'));
          setTimeout(attempt, 100);
        });
    };
    attempt();
  });
}

async function main() {
  for (const f of ['tasks.db', 'tasks.db-wal', 'tasks.db-shm']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // --- round 1: create data ---
  let server = startServer();
  await waitForServer();

  let res = await fetch(`${BASE}/tasks`);
  assertEqual(res.status, 200, 'GET /tasks on empty DB -> 200');
  assertEqual(await res.json(), [], 'GET /tasks on empty DB -> []');

  res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Buy milk' }),
  });
  assertEqual(res.status, 200, 'POST /tasks -> 200');
  const created = await res.json();
  assertEqual(created, { id: created.id, title: 'Buy milk', done: false }, 'POST /tasks body shape');

  res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '' }),
  });
  assertEqual(res.status, 400, 'POST /tasks with empty title -> 400');

  server.kill();
  await new Promise((r) => setTimeout(r, 300));

  // --- round 2: fresh process, confirm persistence ---
  server = startServer();
  await waitForServer();

  res = await fetch(`${BASE}/tasks`);
  const afterRestart = await res.json();
  assertEqual(afterRestart.length, 1, 'data survives a full process restart');

  const id = afterRestart[0].id;

  res = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: true }),
  });
  assertEqual(res.status, 200, 'PUT /tasks/:id -> 200');
  assertEqual((await res.json()).done, true, 'PUT /tasks/:id updates done');

  res = await fetch(`${BASE}/tasks/99999`, { method: 'PUT' });
  assertEqual(res.status, 404, 'PUT missing id -> 404');

  res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  assertEqual(res.status, 200, 'DELETE /tasks/:id -> 200');

  res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  assertEqual(res.status, 404, 'DELETE already-deleted id -> 404');

  server.kill();

  console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});