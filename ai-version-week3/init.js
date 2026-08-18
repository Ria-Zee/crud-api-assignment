const pool = require('./db');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM tasks');

  if (rows[0].count === 0) {
    await pool.query(
      `INSERT INTO tasks (title, done) VALUES ($1, $2), ($3, $4), ($5, $6)`,
      ['Set up repo', false, 'Write CRUD API', false, 'Containerize with Docker', true]
    );
    console.log('Seeded 3 tasks');
  } else {
    console.log(`Tasks table has ${rows[0].count} rows, skipping seed`);
  }
}

module.exports = init;