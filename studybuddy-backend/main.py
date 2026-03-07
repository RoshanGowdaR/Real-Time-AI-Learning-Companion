"""StudyBuddy FastAPI REST API"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import student, upload, chat, notes, voice, memory

app = FastAPI(title="StudyBuddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(student.router, prefix="/api", tags=["student"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(voice.router, prefix="/api", tags=["voice"])
app.include_router(memory.router, prefix="/api", tags=["memory"])


@app.get("/")
def root():
    return {"status": "ok", "message": "StudyBuddy API Running"}
