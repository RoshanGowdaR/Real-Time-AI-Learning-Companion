"""Supabase service"""
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_ANON_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def create_student(name: str, email: str):
    """Insert into students table, return row"""
    result = supabase.table("students").insert({"name": name, "email": email}).execute()
    return result.data[0]


def get_student(student_id: str):
    """Fetch student by id, return row"""
    result = supabase.table("students").select("*").eq("id", student_id).single().execute()
    return result.data


def save_document(student_id: str, filename: str, summary: str):
    """Insert into documents table, return row"""
    result = (
        supabase.table("documents")
        .insert({"student_id": student_id, "filename": filename, "summary": summary})
        .execute()
    )
    return result.data[0]


def get_documents(student_id: str):
    """Fetch all documents for student, return list"""
    result = supabase.table("documents").select("*").eq("student_id", student_id).execute()
    return result.data


def save_session(student_id: str, topics: list, goals: list, duration: int):
    """Insert into sessions table, return row"""
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


def get_recent_sessions(student_id: str):
    """Fetch last 3 sessions ordered by created_at desc, return list"""
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    return result.data
