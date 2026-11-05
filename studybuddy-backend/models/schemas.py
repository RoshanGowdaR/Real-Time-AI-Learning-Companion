"""Pydantic schemas"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    student_id: str
    question: str
    source: str = "text"
    client_local_date: str | None = None
    client_local_time: str | None = None
    emotion: str | None = None
    conversation_history: list[dict] | None = None
    active_notes: str | None = None
    document_name: str | None = None
    selected_source_ids: list[str] | None = None


class FeedbackRequest(BaseModel):
    student_id: str | None = None
    rating: int = 5
    feedback: str = ""
    intent: str | None = None
    emotion: str | None = None
    response_depth: str | None = None



class ChatResponse(BaseModel):
    answer: str
    status: str


class NotesRequest(BaseModel):
    student_id: str | None = None
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


class FlashcardGenerateAnswerRequest(BaseModel):
    subject: str | None = None
    question: str


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
