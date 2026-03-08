"""StudyBuddy FastAPI REST API"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import student, upload, chat, notes, voice, memory, study_data

app = FastAPI(title="StudyBuddy API")


@app.on_event("startup")
def startup():
    print("StudyBuddy REST API is running")
    print("All routes loaded")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "status": "error"},
    )

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
app.include_router(study_data.router, prefix="/api", tags=["study-data"])


@app.get("/")
def root():
    return {"status": "ok", "message": "StudyBuddy API Running"}
