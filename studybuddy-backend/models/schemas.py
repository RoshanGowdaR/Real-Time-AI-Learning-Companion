"""Pydantic schemas"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    student_id: str
    question: str
    source: str = "text"


class ChatResponse(BaseModel):
    answer: str
    status: str


class NotesRequest(BaseModel):
    student_id: str
    document_id: str | None = None
    filename: str | None = None
    query: str | None = None
    search_type: str | None = None  # 'web' or 'research'


class NotesResponse(BaseModel):
    notes: str
    status: str


class DocumentUpdateRequest(BaseModel):
    filename: str | None = None
    summary: str | None = None


class TTSRequest(BaseModel):
    text: str


class SessionRequest(BaseModel):
    student_id: str
    topics_covered: list
    goals: list
    duration_mins: int


class StudentRequest(BaseModel):
    name: str
    email: str


class StudentLoginRequest(BaseModel):
    email: str


class FlashcardCreateRequest(BaseModel):
    student_id: str
    subject: str
    question: str
    answer: str


class FlashcardUpdateRequest(BaseModel):
    subject: str | None = None
    question: str | None = None
    answer: str | None = None
    mastered: bool | None = None


class ScheduleEventCreateRequest(BaseModel):
    student_id: str
    title: str
    subject: str
    date: str
    start_time: str
    end_time: str
    priority: str = "normal"


class WorkspaceCreateRequest(BaseModel):
    student_id: str
    name: str
    workspace_id: str | None = None
