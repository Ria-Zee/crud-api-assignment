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

## Database

This project stores tasks in SQLite instead of memory, using `better-sqlite3`.

**Why SQLite:** it's a single file, no server to install or run, and zero configuration — perfect for a project this size, and it means data survives a server restart.

**Where the database lives:** `tasks.db`, created automatically the first time the server starts. It's git-ignored, so every clone of this repo starts with its own fresh, auto-seeded database rather than inheriting mine.

**Run it:**

```
npm install
node server.js
```

The `tasks` table and 3 example tasks are created automatically on first run.

**Database browser:**

![DB Browser](db-browser-screenshot.png)

**Example query run by hand in DB Browser:**

```
SELECT * FROM tasks WHERE done = 1;
```

Before marking "Buy milk" as done, this returned 1 row (just "Finish assignment"). After updating task 1's `done` field to 1 directly in DB Browser, re-running the same query returned 2 rows — and calling `GET /tasks` through the API immediately reflected the change, with no restart needed. That's the whole point: the API and DB Browser read the exact same file, so there's nothing to keep in sync.

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
## AI vs me

### My prompt

You're a Senior Backend Engineer at Google, build a CRUD API endpoint that will include five endpoints in five different steps.

1. GET  list all task
2. POST create a new task
3. GET a single task
3. PUT update a task
4. DELETE a task

Also add a swagger ui

Pick any language/framework you're comfortable with and use throughout this assignment, no change mid-way.
Make sure you get a status response of 200, 201 on create, or 404 on missing task.
Title is also required.

### What the AI did better

FastAPI generates Swagger UI automatically at /docs with zero extra code. My Express version needed a separate swagger-ui-express install and a hand-written openapi.json spec file. The AI's input validation is also declarative through Pydantic models rather than manual if checks, which means less code and less room for me to miss a case.

### What it got wrong or silently ignored

- I said status 400 for a missing title, it returned 422 instead, because that is FastAPI's default validation behavior and I never told it to override that.
- I never specified the DELETE status code, so it defaulted to 200 instead of the 204 I used, and returned a body instead of an empty one.
- I never specified the task's fields, so it invented description and completed instead of matching my done field, and used UUID ids instead of incrementing integers.
- It did not seed any example data on startup, so /tasks starts empty. My version pre-loads 3 tasks.

### What my prompt forgot to specify, and what the AI silently decided for me

I never said in-memory, no database explicitly, and got lucky that it chose in-memory anyway. I never specified the task object's shape, the DELETE status code, or the exact status code for validation failures. Every one of those gaps got filled by the framework's defaults rather than my intent. That is the actual lesson here: a spec is only as tight as what you write down, not what you assume is obvious.

## AI vs me — Week 3 (SQLite migration)

### My prompt

You're a Senior Backend Engineer, Migrate an in-memory CRUD task API TO SQLite following this 5 steps:
Step 0: Create a database, and confirm with 3 restarts using SQLite + better-sqlite3
Step 1: Read endpoints wired to the sql and tested
Step 2: Run a persistence test with POST wired to SQL
Step 3: Confirm full CRUD cycle with PUT/DELETE wired to SQL
Step 4: install the DB Browser, run raw SQL by hand and confirm the API and DB Browser share the same output or read each other
Step 5: Update README with why-SQLite(if used), with screenshot and example query and push to Github

Note:
Keep the existing API behaviour identical. Only the storage changes, not the routes.
Parameterise queries for safety
For the tasks.db, tables's columns should be; id, title, done
Maintain success status code as 200 and 400/404 for error or empty

### What the AI did better

It wrote a real automated test suite (`test/run-tests.js`) that spawns the actual server as a subprocess, hits it with real HTTP requests, kills the process, restarts it fresh, and checks the data survived. That's a stronger persistence check than my manual curl-and-restart routine. It also added a `CHECK (done IN (0,1))` constraint at the database level, `journal_mode = WAL` for safer concurrent access, validation on `id` (must be a valid integer) and `done` (must be a boolean), and a catch-all handler for malformed JSON and unexpected errors — none of which my version has. Its README's "why SQLite" section also names the tradeoff honestly: SQLite serializes writes, fine for one instance, wrong choice once you need multiple app servers writing to the same database.

### What it got wrong or silently ignored

I told it to "maintain success status code as 200" for everything. It didn't fully follow that: POST returns 201 and DELETE returns 204, both correct REST convention, but not what I literally asked for. It also couldn't install Express in its sandbox (no network access), so instead of just swapping the storage layer like I asked, it rewrote the whole request-handling layer using Node's built-in `http` module — a structural change to my API, not a storage-only change, even though my prompt explicitly said "only the storage changes, not the routes."

### What my prompt forgot to specify, and what the AI silently decided for me

I never said whether `done` should come back as `0`/`1` or `true`/`false` in API responses. It chose `true`/`false`, which is arguably cleaner than my version, which returns raw `0`/`1`. I also didn't specify what to do if Express wasn't available, so when its sandbox couldn't install it, the AI made a significant architectural decision on its own (drop Express entirely) rather than flagging it as a blocker.

### A false negative worth noting

The first time I ran the AI's test suite, 6 of 11 assertions failed. The cause wasn't the AI's code, it was a port collision: my own Week 2/3 server was still running on port 3000 while the test tried to spawn its own server on the same port, so the tests were silently hitting the wrong server the whole time. After stopping my server and rerunning in isolation, all 11 assertions passed. Lesson: a failing test isn't proof of a bug until you've confirmed what it actually tested.