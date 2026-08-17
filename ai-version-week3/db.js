const path = require('path');
const Database = require('better-sqlite3');
const DB_PATH = path.join(__dirname, 'tasks.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT    NOT NULL,
    done  INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1))
  );
`);

module.exports = db;