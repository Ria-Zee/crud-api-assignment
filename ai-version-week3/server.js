require('dotenv').config();
const express = require('express');
const pool = require('./db');
const init = require('./init');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function isValidTitle(title) {
  return typeof title === 'string' && title.trim().length > 0;
}

// GET /tasks
app.get('/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tasks/:id
app.get('/tasks/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tasks
app.post('/tasks', async (req, res) => {
  const { title, done } = req.body;
  if (!isValidTitle(title)) {
    return res.status(400).json({ error: 'Title is required and cannot be empty' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
      [title.trim(), Boolean(done)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /tasks/:id
app.put('/tasks/:id', async (req, res) => {
  const { title, done } = req.body;
  if (!isValidTitle(title)) {
    return res.status(400).json({ error: 'Title is required and cannot be empty' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
      [title.trim(), Boolean(done), req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /tasks/:id
app.delete('/tasks/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, async () => {
  try {
    await init();
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
});