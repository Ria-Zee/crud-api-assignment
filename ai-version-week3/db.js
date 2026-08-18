require('dotenv').config();
const { Pool } = require('pg');

const required = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  }
}

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
  process.exit(1);
});

module.exports = pool;