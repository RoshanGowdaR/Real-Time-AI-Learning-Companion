"""Supabase service.

If Supabase credentials are missing/unusable, falls back to an in-memory store
so the API can still run locally (useful for development and tests).
"""

from __future__ import annotations

from uuid import uuid4

try:
    from supabase import create_client  # type: ignore
except Exception:  # pragma: no cover
    create_client = None

from config import SUPABASE_URL, SUPABASE_ANON_KEY

supabase = None
if create_client and SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception:
        supabase = None

_students: dict[str, dict] = {}
_documents: dict[str, dict] = {}
_sessions: list[dict] = []


def create_student(name: str, email: str):
    """Insert into students table, return row"""
    if supabase is not None:
        try:
            result = supabase.table("students").insert({"name": name, "email": email}).execute()
            return result.data[0]
        except Exception:
            pass

    student_id = str(uuid4())
    row = {"id": student_id, "name": name, "email": email}
    _students[student_id] = row
    return row


def get_student(student_id: str):
    """Fetch student by id, return row"""
    if supabase is not None:
        try:
            result = (
                supabase.table("students").select("*").eq("id", student_id).single().execute()
            )
            return result.data
        except Exception:
            pass

    row = _students.get(student_id)
    if not row:
        raise KeyError(f"Student not found: {student_id}")
    return row


def save_document(student_id: str, filename: str, summary: str):
    """Insert into documents table, return row"""
    if supabase is not None:
        try:
            result = (
                supabase.table("documents")
                .insert({"student_id": student_id, "filename": filename, "summary": summary})
                .execute()
            )
            return result.data[0]
        except Exception:
            pass

    doc_id = str(uuid4())
    row = {"id": doc_id, "student_id": student_id, "filename": filename, "summary": summary}
    _documents[doc_id] = row
    return row


def get_documents(student_id: str):
    """Fetch all documents for student, return list"""
    if supabase is not None:
        try:
            result = (
                supabase.table("documents").select("*").eq("student_id", student_id).execute()
            )
            return result.data
        except Exception:
            pass

    return [d for d in _documents.values() if d.get("student_id") == student_id]


def save_session(student_id: str, topics: list, goals: list, duration: int):
    """Insert into sessions table, return row"""
    if supabase is not None:
        try:
            result = (
                supabase.table("sessions")
                .insert(
                    {
                        "student_id": student_id,
                        "topics_covered": topics,
                        "goals": goals,
                        "duration_mins": duration,
                    }
                )
                .execute()
            )
            return result.data[0]
        except Exception:
            pass

    session_id = str(uuid4())
    row = {
        "id": session_id,
        "student_id": student_id,
        "topics_covered": topics,
        "goals": goals,
        "duration_mins": duration,
    }
    _sessions.append(row)
    return row


def get_recent_sessions(student_id: str):
    """Fetch last 3 sessions ordered by created_at desc, return list"""
    if supabase is not None:
        try:
            result = (
                supabase.table("sessions")
                .select("*")
                .eq("student_id", student_id)
                .order("created_at", desc=True)
                .limit(3)
                .execute()
            )
            return result.data
        except Exception:
            pass

    matches = [s for s in _sessions if s.get("student_id") == student_id]
    return matches[-3:][::-1]
