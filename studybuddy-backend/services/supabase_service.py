"""Supabase service"""
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_ANON_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def _is_missing_table_error(exc: Exception) -> bool:
    """Detect PostgREST missing-table errors so callers can degrade gracefully."""
    message = str(exc).lower()
    return "pgrst205" in message or "could not find the table" in message


def _is_missing_subject_enrollment_columns_error(exc: Exception) -> bool:
    """Detect schema mismatch when new enrollment status columns are not present yet."""
    message = str(exc).lower()
    if "subject_enrollments" not in message:
        return False
    return (
        "status" in message
        or "requested_at" in message
        or "reviewed_at" in message
    )


def _teacher_name(teacher_field) -> str:
    """Normalize embedded teacher relation payload into a single display name."""
    if isinstance(teacher_field, list):
        if not teacher_field:
            return "Unknown"
        first = teacher_field[0] if isinstance(teacher_field[0], dict) else None
        return first.get("full_name", "Unknown") if first else "Unknown"

    if isinstance(teacher_field, dict):
        return teacher_field.get("full_name", "Unknown")

    return "Unknown"


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


async def create_org_admin(
    name: str,
    description: str,
    invite_code: str,
    admin_email: str,
    password_hash: str,
):
    """Create one organization row with admin credentials."""
    result = (
        supabase.table("organizations")
        .insert(
            {
                "name": name,
                "description": description,
                "invite_code": invite_code,
                "admin_email": admin_email,
                "password_hash": password_hash,
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


async def get_org_by_admin_email(email: str):
    """Fetch organization by admin email."""
    result = (
        supabase.table("organizations")
        .select("*")
        .eq("admin_email", email)
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


async def get_subject_by_id(subject_id: str):
    """Fetch subject by id."""
    result = (
        supabase.table("subjects")
        .select("*")
        .eq("id", subject_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_subject_by_code(subject_code: str):
    """Fetch subject by subject code."""
    normalized_code = (subject_code or "").strip().upper()
    result = (
        supabase.table("subjects")
        .select("*")
        .eq("subject_code", normalized_code)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def create_announcement(subject_id: str, teacher_id: str, title: str, body: str, tag: str):
    """Create one announcement row."""
    try:
        result = (
            supabase.table("announcements")
            .insert(
                {
                    "subject_id": subject_id,
                    "teacher_id": teacher_id,
                    "title": title,
                    "body": body,
                    "tag": tag,
                }
            )
            .execute()
        )
        return result.data[0]
    except Exception as exc:
        if _is_missing_table_error(exc):
            raise RuntimeError(
                "Announcements storage is not set up yet. Run studybuddy-backend/supabase_schema.sql "
                "(or studybuddy-backend/supabase_patch_org_tables.sql) in Supabase SQL Editor, then retry."
            ) from exc
        raise


async def create_assignment(
    subject_id: str,
    teacher_id: str,
    title: str,
    description: str,
    due_date: str | None,
    max_score: int,
):
    """Create one assignment row."""
    payload = {
        "subject_id": subject_id,
        "teacher_id": teacher_id,
        "title": title,
        "description": description,
        "max_score": max_score,
    }
    if due_date:
        payload["due_date"] = due_date

    try:
        result = supabase.table("assignments").insert(payload).execute()
        return result.data[0]
    except Exception as exc:
        if _is_missing_table_error(exc):
            raise RuntimeError(
                "Assignments storage is not set up yet. Run studybuddy-backend/supabase_schema.sql "
                "(or studybuddy-backend/supabase_patch_org_tables.sql) in Supabase SQL Editor, then retry."
            ) from exc
        raise


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


async def create_subject_enrollment_request(subject_id: str, student_id: str):
    """Create or reopen a subject enrollment request and return (row, action)."""
    from datetime import datetime

    now_iso = datetime.now().isoformat()

    try:
        existing = (
            supabase.table("subject_enrollments")
            .select("*")
            .eq("subject_id", subject_id)
            .eq("student_id", student_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            row = existing.data[0]
            current_status = str(row.get("status") or "").lower()

            if current_status == "approved":
                return row, "already_approved"

            if current_status == "pending":
                return row, "already_pending"

            updated = (
                supabase.table("subject_enrollments")
                .update(
                    {
                        "status": "pending",
                        "requested_at": now_iso,
                        "reviewed_at": None,
                        "enrolled_at": None,
                    }
                )
                .eq("id", row["id"])
                .execute()
            )
            return updated.data[0], "reopened"

        created = (
            supabase.table("subject_enrollments")
            .insert(
                {
                    "subject_id": subject_id,
                    "student_id": student_id,
                    "status": "pending",
                    "requested_at": now_iso,
                }
            )
            .execute()
        )
        return created.data[0], "created"
    except Exception as exc:
        if _is_missing_subject_enrollment_columns_error(exc):
            raise RuntimeError(
                "Subject enrollment status columns are not set up yet. "
                "Run studybuddy-backend/supabase_schema.sql "
                "(or studybuddy-backend/supabase_patch_org_tables.sql) in Supabase SQL Editor, then retry."
            ) from exc
        raise


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


async def get_pending_subject_enrollments(subject_id: str):
    """Fetch pending enrollment requests for one subject with student info."""
    try:
        result = (
            supabase.table("subject_enrollments")
            .select(
                "id, subject_id, student_id, status, requested_at, reviewed_at, "
                "students(id, name, email), "
                "subjects(id, name, subject_code, org_id, teacher_id, organizations(id, name), teachers(id, full_name, email))"
            )
            .eq("subject_id", subject_id)
            .eq("status", "pending")
            .order("requested_at", desc=False)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        if _is_missing_subject_enrollment_columns_error(exc):
            return []
        raise


async def get_org_pending_subject_enrollments(org_id: str):
    """Fetch pending enrollment requests for all subjects in one organization."""
    subjects_result = (
        supabase.table("subjects")
        .select("id")
        .eq("org_id", org_id)
        .execute()
    )
    subject_ids = [row.get("id") for row in (subjects_result.data or []) if row.get("id")]
    if not subject_ids:
        return []

    try:
        result = (
            supabase.table("subject_enrollments")
            .select(
                "id, subject_id, student_id, status, requested_at, reviewed_at, "
                "students(id, name, email), "
                "subjects(id, name, subject_code, org_id, teacher_id, organizations(id, name), teachers(id, full_name, email))"
            )
            .in_("subject_id", subject_ids)
            .eq("status", "pending")
            .order("requested_at", desc=False)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        if _is_missing_subject_enrollment_columns_error(exc):
            return []
        raise


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


async def get_subject_enrollment_by_id(enrollment_id: str):
    """Fetch subject enrollment row by id."""
    result = (
        supabase.table("subject_enrollments")
        .select("*")
        .eq("id", enrollment_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def update_subject_enrollment_status(enrollment_id: str, status: str):
    """Approve/reject one subject enrollment request."""
    from datetime import datetime

    now_iso = datetime.now().isoformat()
    payload = {
        "status": status,
        "reviewed_at": now_iso,
    }
    payload["enrolled_at"] = now_iso if status == "approved" else None

    try:
        result = (
            supabase.table("subject_enrollments")
            .update(payload)
            .eq("id", enrollment_id)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as exc:
        if _is_missing_subject_enrollment_columns_error(exc):
            raise RuntimeError(
                "Subject enrollment status columns are not set up yet. "
                "Run studybuddy-backend/supabase_schema.sql "
                "(or studybuddy-backend/supabase_patch_org_tables.sql) in Supabase SQL Editor, then retry."
            ) from exc
        raise


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


async def get_student_subject_enrollments(student_id: str):
    """Fetch all subject enrollments for one student with subject/org/teacher context."""
    try:
        result = (
            supabase.table("subject_enrollments")
            .select(
                "id, subject_id, student_id, status, requested_at, reviewed_at, enrolled_at, "
                "subjects(id, name, subject_code, org_id, organizations(id, name), teachers(id, full_name, email))"
            )
            .eq("student_id", student_id)
            .order("requested_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        if _is_missing_subject_enrollment_columns_error(exc):
            return []
        raise


async def enroll_student_in_subjects(student_id: str, org_id: str):
    """Enroll approved student in all existing org subjects."""
    from datetime import datetime

    now_iso = datetime.now().isoformat()
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
                        "status": "approved",
                        "requested_at": now_iso,
                        "reviewed_at": now_iso,
                        "enrolled_at": now_iso,
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


async def delete_teacher_and_subjects(org_id: str, teacher_id: str):
    """Delete a teacher and all subjects owned by that teacher in the organization."""
    subject_rows = (
        supabase.table("subjects")
        .select("id")
        .eq("org_id", org_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    subject_ids = [row.get("id") for row in (subject_rows.data or []) if row.get("id")]

    deleted_subjects = 0
    if subject_ids:
        deleted_subject_rows = (
            supabase.table("subjects")
            .delete()
            .in_("id", subject_ids)
            .execute()
        )
        deleted_subjects = len(deleted_subject_rows.data or [])

    deleted_teacher_rows = (
        supabase.table("teachers")
        .delete()
        .eq("id", teacher_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not deleted_teacher_rows.data:
        return None

    return {
        "teacher": deleted_teacher_rows.data[0],
        "deleted_subjects": deleted_subjects,
        "subject_ids": subject_ids,
    }


async def get_announcements_by_subject(subject_id: str):
    """Fetch announcements for one subject ordered by newest first."""
    try:
        result = (
            supabase.table("announcements")
            .select("id, subject_id, teacher_id, title, body, tag, created_at, teachers(full_name)")
            .eq("subject_id", subject_id)
            .order("created_at", desc=True)
            .execute()
        )

        rows = result.data or []
        announcements = []
        for row in rows:
            announcements.append(
                {
                    "id": row.get("id"),
                    "subject_id": row.get("subject_id"),
                    "teacher_id": row.get("teacher_id"),
                    "title": row.get("title") or "Announcement",
                    "body": row.get("body") or "",
                    "tag": row.get("tag") or "General",
                    "created_at": row.get("created_at"),
                    "teacher_name": _teacher_name(row.get("teachers")),
                }
            )
        return announcements
    except Exception as exc:
        if _is_missing_table_error(exc):
            return []
        raise


async def get_assignments_by_subject(subject_id: str):
    """Fetch assignments for one subject ordered by due date."""
    try:
        result = (
            supabase.table("assignments")
            .select("id, subject_id, teacher_id, title, description, due_date, max_score, created_at")
            .eq("subject_id", subject_id)
            .order("due_date", desc=False)
            .execute()
        )
        return result.data or []
    except Exception as exc:
        if _is_missing_table_error(exc):
            return []
        raise
