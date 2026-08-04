"""
Task CRUD API
Framework: FastAPI (Python)
Swagger UI: auto-generated at /docs, ReDoc at /redoc
Storage: in-memory dict (swap for a real DB in production)
"""
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from uuid import uuid4

app = FastAPI(
    title="Task API",
    description="A simple CRUD API for managing tasks.",
    version="1.0.0",
)

tasks_db: dict[str, dict] = {}

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, description="Task title. Required.")
    description: Optional[str] = Field(None, description="Task details.")
    completed: bool = Field(False, description="Completion status.")

class TaskUpdate(BaseModel):
    title: str = Field(..., min_length=1, description="Task title. Required.")
    description: Optional[str] = None
    completed: bool = False

class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    completed: bool = False

@app.get("/tasks", response_model=list[Task], status_code=status.HTTP_200_OK, tags=["Tasks"])
def list_tasks():
    return list(tasks_db.values())

@app.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED, tags=["Tasks"])
def create_task(payload: TaskCreate):
    task_id = str(uuid4())
    task = {
        "id": task_id,
        "title": payload.title,
        "description": payload.description,
        "completed": payload.completed,
    }
    tasks_db[task_id] = task
    return task

@app.get("/tasks/{task_id}", response_model=Task, status_code=status.HTTP_200_OK, tags=["Tasks"])
def get_task(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task

@app.put("/tasks/{task_id}", response_model=Task, status_code=status.HTTP_200_OK, tags=["Tasks"])
def update_task(task_id: str, payload: TaskUpdate):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task["title"] = payload.title
    task["description"] = payload.description
    task["completed"] = payload.completed
    tasks_db[task_id] = task
    return task

@app.delete("/tasks/{task_id}", status_code=status.HTTP_200_OK, tags=["Tasks"])
def delete_task(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    del tasks_db[task_id]
    return {"detail": "Task deleted", "id": task_id}