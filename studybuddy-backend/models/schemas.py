"""Pydantic schemas"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    student_id: str
    question: str


class ChatResponse(BaseModel):
    answer: str
    status: str


class NotesRequest(BaseModel):
    student_id: str
    document_id: str
    filename: str


class NotesResponse(BaseModel):
    notes: str
    status: str


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
