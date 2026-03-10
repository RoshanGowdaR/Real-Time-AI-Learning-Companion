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


def get_student_by_email(email: str):
    """Fetch student by email, return row"""
    result = supabase.table("students").select("*").eq("email", email).single().execute()
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


def update_document(student_id: str, document_id: str, updates: dict):
    """Update document fields by student and id, return updated row or None."""
    if not updates:
        return None

    result = (
        supabase.table("documents")
        .update(updates)
        .eq("id", document_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def delete_document(student_id: str, document_id: str):
    """Delete document by student and id, return deleted row or None."""
    result = (
        supabase.table("documents")
        .delete()
        .eq("id", document_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


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
    """Fetch recent sessions ordered by created_at desc, return list"""
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )
    return result.data


def save_chat_message(student_id: str, question: str, answer: str, source: str = "text"):
    """Insert a chat/talk message pair and return created row."""
    result = (
        supabase.table("chat_messages")
        .insert(
            {
                "student_id": student_id,
                "question": question,
                "answer": answer,
                "source": source,
            }
        )
        .execute()
    )
    return result.data[0]


def get_chat_messages(student_id: str, limit: int = 100):
    """Fetch recent chat/talk messages ordered by created_at desc."""
    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


def delete_chat_message(student_id: str, message_id: str):
    """Delete one chat message by student and id, return deleted row or None."""
    result = (
        supabase.table("chat_messages")
        .delete()
        .eq("id", message_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def clear_chat_messages(student_id: str):
    """Delete all chat messages for a student, return deleted rows."""
    result = (
        supabase.table("chat_messages")
        .delete()
        .eq("student_id", student_id)
        .execute()
    )
    return result.data or []


def create_flashcard(student_id: str, subject: str, question: str, answer: str):
    """Insert a flashcard row and return it."""
    result = (
        supabase.table("flashcards")
        .insert(
            {
                "student_id": student_id,
                "subject": subject,
                "question": question,
                "answer": answer,
                "mastered": False,
            }
        )
        .execute()
    )
    return result.data[0]


def get_flashcards(student_id: str):
    """Fetch flashcards for a student."""
    result = (
        supabase.table("flashcards")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def update_flashcard(student_id: str, flashcard_id: str, updates: dict):
    """Update flashcard fields by student and id, return updated row or None."""
    if not updates:
        return None

    result = (
        supabase.table("flashcards")
        .update(updates)
        .eq("id", flashcard_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def delete_flashcard(student_id: str, flashcard_id: str):
    """Delete one flashcard and return deleted row or None."""
    result = (
        supabase.table("flashcards")
        .delete()
        .eq("id", flashcard_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def increment_flashcard_review(student_id: str, review_date: str):
    """Increment today's review counter and return updated row."""
    existing = (
        supabase.table("flashcard_review_days")
        .select("*")
        .eq("student_id", student_id)
        .eq("review_date", review_date)
        .limit(1)
        .execute()
    )
    rows = existing.data or []

    if rows:
        current = rows[0]
        next_count = int(current.get("review_count") or 0) + 1
        updated = (
            supabase.table("flashcard_review_days")
            .update({"review_count": next_count})
            .eq("id", current["id"])
            .eq("student_id", student_id)
            .execute()
        )
        if updated.data:
            return updated.data[0]
        return {**current, "review_count": next_count}

    created = (
        supabase.table("flashcard_review_days")
        .insert(
            {
                "student_id": student_id,
                "review_date": review_date,
                "review_count": 1,
            }
        )
        .execute()
    )
    return created.data[0]


def get_flashcard_review_days(student_id: str):
    """Fetch review counters grouped per date for streak/progress."""
    result = (
        supabase.table("flashcard_review_days")
        .select("*")
        .eq("student_id", student_id)
        .order("review_date", desc=False)
        .execute()
    )
    return result.data


def create_schedule_event(
    student_id: str,
    title: str,
    subject: str,
    date: str,
    start_time: str,
    end_time: str,
    priority: str,
):
    """Insert a custom schedule event and return it."""
    result = (
        supabase.table("schedule_events")
        .insert(
            {
                "student_id": student_id,
                "title": title,
                "subject": subject,
                "date": date,
                "start_time": start_time,
                "end_time": end_time,
                "priority": priority,
            }
        )
        .execute()
    )
    return result.data[0]


def get_schedule_events(student_id: str):
    """Fetch custom schedule events for a student."""
    result = (
        supabase.table("schedule_events")
        .select("*")
        .eq("student_id", student_id)
        .order("date", desc=False)
        .order("start_time", desc=False)
        .execute()
    )
    return result.data


def delete_schedule_event(student_id: str, event_id: str):
    """Delete one custom schedule event and return deleted row or None."""
    result = (
        supabase.table("schedule_events")
        .delete()
        .eq("id", event_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def create_workspace(student_id: str, name: str, workspace_id: str | None = None):
    """Create one workspace for a student and return it."""
    payload = {
        "student_id": student_id,
        "name": name,
    }
    if workspace_id:
        payload["id"] = workspace_id

    result = supabase.table("workspaces").insert(payload).execute()
    return result.data[0]


def get_workspaces(student_id: str):
    """Fetch all workspaces for a student."""
    result = (
        supabase.table("workspaces")
        .select("*")
        .eq("student_id", student_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


def delete_workspace(student_id: str, workspace_id: str):
    """Delete one workspace and return deleted row or None."""
    result = (
        supabase.table("workspaces")
        .delete()
        .eq("id", workspace_id)
        .eq("student_id", student_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


def get_workspace_document_links(student_id: str):
    """Fetch workspace-document assignments for a student."""
    result = (
        supabase.table("workspace_documents")
        .select("*")
        .eq("student_id", student_id)
        .execute()
    )
    return result.data


def assign_workspace_document(student_id: str, workspace_id: str, document_id: str):
    """Assign a document to a workspace, returning existing/new row."""
    existing = (
        supabase.table("workspace_documents")
        .select("*")
        .eq("student_id", student_id)
        .eq("workspace_id", workspace_id)
        .eq("document_id", document_id)
        .limit(1)
        .execute()
    )

    rows = existing.data or []
    if rows:
        return rows[0]

    created = (
        supabase.table("workspace_documents")
        .insert(
            {
                "student_id": student_id,
                "workspace_id": workspace_id,
                "document_id": document_id,
            }
        )
        .execute()
    )
    return created.data[0]


def remove_workspace_document(student_id: str, workspace_id: str, document_id: str):
    """Remove workspace-document assignment and return deleted row or None."""
    result = (
        supabase.table("workspace_documents")
        .delete()
        .eq("student_id", student_id)
        .eq("workspace_id", workspace_id)
        .eq("document_id", document_id)
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


async def log_emotion(student_id: str, emotion: str, confidence: float):
    """Insert one emotion detection row and return inserted row or None."""
    result = (
        supabase.table("emotion_logs")
        .insert(
            {
                "student_id": student_id,
                "emotion": emotion,
                "confidence": float(confidence),
            }
        )
        .execute()
    )

    if result.data:
        return result.data[0]
    return None


async def create_org(name: str, description: str, invite_code: str):
    """Create one organization row."""
    result = (
        supabase.table("organizations")
        .insert(
            {
                "name": name,
                "description": description,
                "invite_code": invite_code,
            }
        )
        .execute()
    )
    return result.data[0]


async def get_org_by_invite_code(code: str):
    """Fetch organization by invite code."""
    result = (
        supabase.table("organizations")
        .select("*")
        .eq("invite_code", code)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_org_by_id(org_id: str):
    """Fetch organization by id."""
    result = (
        supabase.table("organizations")
        .select("*")
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def create_teacher(email: str, password_hash: str, full_name: str, org_id: str):
    """Create one teacher row."""
    result = (
        supabase.table("teachers")
        .insert(
            {
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "org_id": org_id,
            }
        )
        .execute()
    )
    return result.data[0]


async def get_teacher_by_email(email: str):
    """Fetch teacher by email."""
    result = (
        supabase.table("teachers")
        .select("*")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_teacher_by_id(teacher_id: str):
    """Fetch teacher by id."""
    result = (
        supabase.table("teachers")
        .select("*")
        .eq("id", teacher_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def create_subject(org_id: str, teacher_id: str, name: str, subject_code: str):
    """Create one subject row."""
    result = (
        supabase.table("subjects")
        .insert(
            {
                "org_id": org_id,
                "teacher_id": teacher_id,
                "name": name,
                "subject_code": subject_code,
            }
        )
        .execute()
    )
    return result.data[0]


async def get_subjects_by_org(org_id: str):
    """Fetch all subjects in one organization with teacher info."""
    result = (
        supabase.table("subjects")
        .select("*, teachers(full_name, email)")
        .eq("org_id", org_id)
        .execute()
    )
    return result.data


async def get_subjects_by_teacher(teacher_id: str):
    """Fetch subjects created by one teacher."""
    result = (
        supabase.table("subjects")
        .select("*")
        .eq("teacher_id", teacher_id)
        .execute()
    )
    return result.data


async def create_org_member(org_id: str, student_id: str):
    """Create membership request row if not already present."""
    existing = (
        supabase.table("org_members")
        .select("*")
        .eq("org_id", org_id)
        .eq("student_id", student_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return None

    result = (
        supabase.table("org_members")
        .insert(
            {
                "org_id": org_id,
                "student_id": student_id,
                "status": "pending",
            }
        )
        .execute()
    )
    return result.data[0]


async def get_pending_members(org_id: str):
    """Fetch pending org membership requests with student info."""
    result = (
        supabase.table("org_members")
        .select("*, students(name, email)")
        .eq("org_id", org_id)
        .eq("status", "pending")
        .execute()
    )
    return result.data


async def update_member_status(member_id: str, status: str):
    """Update membership decision status."""
    from datetime import datetime

    result = (
        supabase.table("org_members")
        .update(
            {
                "status": status,
                "reviewed_at": datetime.now().isoformat(),
            }
        )
        .eq("id", member_id)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_student_orgs(student_id: str):
    """Fetch approved organizations for a student."""
    result = (
        supabase.table("org_members")
        .select("*, organizations(id, name, invite_code)")
        .eq("student_id", student_id)
        .eq("status", "approved")
        .execute()
    )
    return result.data


async def enroll_student_in_subjects(student_id: str, org_id: str):
    """Enroll approved student in all existing org subjects."""
    subjects = await get_subjects_by_org(org_id)
    for subject in subjects:
        existing = (
            supabase.table("subject_enrollments")
            .select("*")
            .eq("subject_id", subject["id"])
            .eq("student_id", student_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            (
                supabase.table("subject_enrollments")
                .insert(
                    {
                        "subject_id": subject["id"],
                        "student_id": student_id,
                    }
                )
                .execute()
            )


async def get_student_enrollments(student_id: str, org_id: str):
    """Fetch student enrollments and related subject + teacher details."""
    result = (
        supabase.table("subject_enrollments")
        .select("*, subjects(id, name, subject_code, teachers(full_name), org_id)")
        .eq("student_id", student_id)
        .execute()
    )

    rows = result.data or []
    if not org_id:
        return rows

    return [
        row
        for row in rows
        if isinstance(row.get("subjects"), dict)
        and str(row["subjects"].get("org_id") or "") == str(org_id)
    ]
