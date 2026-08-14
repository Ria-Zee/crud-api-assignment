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

let tasks = [
    { id: 1, title: 'Buy milk', done: false },
    { id: 2, title: 'Walk the dog', done: false },
    { id: 3, title: 'Finish assignment', done: true }
  ];

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
    res.json(tasks);
  });
  
  app.get('/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const task = tasks.find(t => t.id === id);
  
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
  
    const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
  
    const newTask = { id: nextId, title, done: false };
    tasks.push(newTask);
  
    res.status(201).json(newTask);
  });

  app.put('/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const task = tasks.find(t => t.id === id);
  
    if (!task) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
  
    const { title, done } = req.body;
  
    if (title !== undefined && title.trim() === '') {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
  
    if (title !== undefined) task.title = title;
    if (done !== undefined) task.done = done;
  
    res.json(task);
  });
  
  app.delete('/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const index = tasks.findIndex(t => t.id === id);
  
    if (index === -1) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
  
    tasks.splice(index, 1);
    res.status(204).send();
  });

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});