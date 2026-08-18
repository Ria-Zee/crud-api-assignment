const express = require('express');
const { pool, init } = require('./db');
const app = express();

app.use(express.json());

const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

const PORT = 3000;



  app.get('/', (req, res) => {
    res.json({
      name: 'Task API',
      version: '1.0',
      endpoints: ['/tasks']
    });
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/tasks', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks');
  res.json(rows);
});

app.get('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const task = rows[0];
  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  res.json(task);
});

  app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [title, false]
  );
  res.status(201).json(rows[0]);
});

app.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const task = rows[0];
  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  const { title, done } = req.body;
  if (title !== undefined && title.trim() === '') {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? done : task.done;
  const { rows: updatedRows } = await pool.query(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
    [updatedTitle, updatedDone, id]
  );
  res.json(updatedRows[0]);
});

app.delete('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const task = rows[0];
  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  res.status(204).send();
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });