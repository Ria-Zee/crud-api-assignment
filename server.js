const express = require('express');
const Database = require('better-sqlite3');
const db = new Database('tasks.db');
const app = express();
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);
const row = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (row.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Buy milk', 0);
  insert.run('Walk the dog', 0);
  insert.run('Finish assignment', 1);
}

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

  app.get('/tasks', (req, res) => {
  const allTasks = db.prepare('SELECT * FROM tasks').all();
  res.json(allTasks);
  });
  
  app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.json(task);
  });

  app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const result = insert.run(title, 0);

  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(newTask);
  });

  app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body;

  if (title !== undefined && title.trim() === '') {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }

  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : task.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updatedTask);
  });
  
  app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.status(204).send();
  });

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});