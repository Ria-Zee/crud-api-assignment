// server.js
// Route shapes and status codes are unchanged from the in-memory version.
// Only the storage layer changed: every handler below calls into db.js
// (SQLite/better-sqlite3) instead of touching an in-memory array.

const http = require('http');
const { URL } = require('url');
const db = require('./db');

const PORT = process.env.PORT || 3000;

// --- prepared statements (parameterised: no string-built SQL, ever) -------
const stmts = {
  all:    db.prepare('SELECT id, title, done FROM tasks ORDER BY id'),
  byId:   db.prepare('SELECT id, title, done FROM tasks WHERE id = ?'),
  insert: db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)'),
  update: db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM tasks WHERE id = ?'),
};

// SQLite has no boolean type. Store 0/1, always hand back true/false.
const toApi = (row) => ({ id: row.id, title: row.title, done: !!row.done });

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // guard against runaway bodies
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function validateTaskInput(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      errors.push('title is required and must be a non-empty string');
    }
  }
  if (body.done !== undefined && typeof body.done !== 'boolean') {
    errors.push('done must be a boolean');
  }
  return errors;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean); // ['tasks', ':id'?]

  try {
    if (segments[0] !== 'tasks') {
      return sendJSON(res, 404, { error: 'Not found' });
    }

    // GET /tasks
    if (req.method === 'GET' && segments.length === 1) {
      const rows = stmts.all.all();
      return sendJSON(res, 200, rows.map(toApi));
    }

    // GET /tasks/:id
    if (req.method === 'GET' && segments.length === 2) {
      const id = Number(segments[1]);
      if (!Number.isInteger(id)) return sendJSON(res, 400, { error: 'id must be an integer' });
      const row = stmts.byId.get(id);
      if (!row) return sendJSON(res, 404, { error: 'Task not found' });
      return sendJSON(res, 200, toApi(row));
    }

    // POST /tasks
    if (req.method === 'POST' && segments.length === 1) {
      const body = await readBody(req);
      const errors = validateTaskInput(body);
      if (errors.length) return sendJSON(res, 400, { error: errors.join('; ') });
      const done = body.done === true ? 1 : 0;
      const info = stmts.insert.run(body.title.trim(), done);
      const row = stmts.byId.get(info.lastInsertRowid);
      return sendJSON(res, 200, toApi(row));
    }

    // PUT /tasks/:id
    if (req.method === 'PUT' && segments.length === 2) {
      const id = Number(segments[1]);
      if (!Number.isInteger(id)) return sendJSON(res, 400, { error: 'id must be an integer' });
      const existing = stmts.byId.get(id);
      if (!existing) return sendJSON(res, 404, { error: 'Task not found' });

      const body = await readBody(req);
      const errors = validateTaskInput(body, { partial: true });
      if (errors.length) return sendJSON(res, 400, { error: errors.join('; ') });

      const title = body.title !== undefined ? body.title.trim() : existing.title;
      const done = body.done !== undefined ? (body.done ? 1 : 0) : existing.done;
      stmts.update.run(title, done, id);
      const row = stmts.byId.get(id);
      return sendJSON(res, 200, toApi(row));
    }

    // DELETE /tasks/:id
    if (req.method === 'DELETE' && segments.length === 2) {
      const id = Number(segments[1]);
      if (!Number.isInteger(id)) return sendJSON(res, 400, { error: 'id must be an integer' });
      const existing = stmts.byId.get(id);
      if (!existing) return sendJSON(res, 404, { error: 'Task not found' });
      stmts.remove.run(id);
      return sendJSON(res, 200, { deleted: true, id });
    }

    return sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }
    console.error(err);
    return sendJSON(res, 500, { error: 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`task-api listening on :${PORT}`));
}

module.exports = server;