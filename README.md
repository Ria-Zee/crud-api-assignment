# Task API

A minimal CRUD API for managing a to-do list. Built with Express, in-memory storage (no database — data resets on restart).

## Run it

```bash
npm install
node server.js
```

Server runs on `http://localhost:3000`.

## Endpoints

| Method | Path          | Description              |
|--------|---------------|---------------------------|
| GET    | /             | API info                  |
| GET    | /health       | Health check               |
| GET    | /tasks        | List all tasks             |
| GET    | /tasks/:id    | Get a single task          |
| POST   | /tasks        | Create a new task          |
| PUT    | /tasks/:id    | Update a task               |
| DELETE | /tasks/:id    | Delete a task                |

## Swagger UI

Interactive docs available at `http://localhost:3000/docs` once the server is running.

![Swagger UI](swagger-screenshot.png)

## Example request

​```
curl -i http://localhost:3000/tasks
​```

Response:

​```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[{"id":1,"title":"Buy oat milk","done":false},{"id":2,"title":"Walk the dog","done":true}]
​```