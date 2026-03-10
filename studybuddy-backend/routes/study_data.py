"""Study data routes for flashcards, schedules, and workspaces."""
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from models.schemas import (
    FlashcardCreateRequest,
    FlashcardGenerateAnswerRequest,
    FlashcardUpdateRequest,
    ScheduleEventCreateRequest,
    WorkspaceCreateRequest,
)
from services import supabase_service
from services.llm_service import generate_flashcard_answer
from services.rag_service import query_rag

router = APIRouter()

FLASHCARDS_TABLE_SETUP_MESSAGE = (
    "Flashcards storage is not set up yet. Run "
    "studybuddy-backend/supabase_schema.sql in Supabase SQL Editor once (recommended), "
    "or run studybuddy-backend/supabase_patch_flashcards.sql to create only flashcard tables, then retry."
)

SCHEDULE_TABLE_SETUP_MESSAGE = (
    "Schedule storage is not set up yet. Run "
    "studybuddy-backend/supabase_schema.sql in Supabase SQL Editor once (recommended), "
    "or run studybuddy-backend/supabase_patch_schedule_events.sql to create only schedule tables, then retry."
)

TABLE_NOT_FOUND_PATTERN = re.compile(r"public\.([a-z_][a-z0-9_]*)")

TABLE_SETUP_MESSAGES = {
    "flashcards": FLASHCARDS_TABLE_SETUP_MESSAGE,
    "flashcard_review_days": FLASHCARDS_TABLE_SETUP_MESSAGE,
    "schedule_events": SCHEDULE_TABLE_SETUP_MESSAGE,
}


def _extract_missing_table(error_text: str):
    """Return missing public table name from PostgREST errors if present."""
    lowered = error_text.lower()

    if "pgrst205" not in lowered and "could not find the table" not in lowered:
        return None

    match = TABLE_NOT_FOUND_PATTERN.search(lowered)
    if not match:
        return None

    return match.group(1)


def _raise_study_data_error(exc: Exception):
    """Convert noisy Supabase/PostgREST failures into actionable API errors."""
    error_text = str(exc)
    table_name = _extract_missing_table(error_text)

    if table_name:
        detail = TABLE_SETUP_MESSAGES.get(table_name)
        if detail:
            raise HTTPException(status_code=503, detail=detail)

        raise HTTPException(
            status_code=503,
            detail=(
                f"Database table `public.{table_name}` is not set up yet. "
                "Run studybuddy-backend/supabase_schema.sql in Supabase SQL Editor, then retry."
            ),
        )

    raise HTTPException(status_code=500, detail=error_text)


def _build_review_history(rows):
    history = {}
    for row in rows:
        day_key = str(row.get("review_date"))
        history[day_key] = int(row.get("review_count") or 0)
    return history


def _calculate_streak(history):
    streak = 0
    cursor = date.today()

    while True:
        key = cursor.isoformat()
        if history.get(key, 0) > 0:
            streak += 1
            cursor -= timedelta(days=1)
            continue
        break

    return streak


@router.get("/flashcards/{student_id}")
async def get_flashcards(student_id: str):
    """Fetch all flashcards for a student."""
    try:
        rows = supabase_service.get_flashcards(student_id)
        return {
            "flashcards": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/flashcards")
async def create_flashcard(body: FlashcardCreateRequest):
    """Create a flashcard row in Supabase."""
    try:
        subject = body.subject.strip() or "General"
        question = body.question.strip()
        answer = body.answer.strip()

        if not question or not answer:
            raise HTTPException(status_code=400, detail="Question and answer are required")

        row = supabase_service.create_flashcard(
            student_id=body.student_id,
            subject=subject,
            question=question,
            answer=answer,
        )
        return {
            "flashcard": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/flashcards/{student_id}/generate-answer")
async def generate_flashcard_answer_route(student_id: str, body: FlashcardGenerateAnswerRequest):
    """Generate an AI answer for a flashcard question."""
    try:
        question = body.question.strip()
        subject = (body.subject or "").strip() or "General"

        if not question:
            raise HTTPException(status_code=400, detail="Question is required")

        context = query_rag(question, student_id)
        answer = generate_flashcard_answer(
            question=question,
            subject=subject,
            context=context,
        )

        return {
            "answer": answer,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.get("/flashcards/{student_id}/review-stats")
async def get_flashcard_review_stats(student_id: str):
    """Fetch flashcard review history and computed streak."""
    try:
        rows = supabase_service.get_flashcard_review_days(student_id)
        history = _build_review_history(rows)
        today_key = date.today().isoformat()

        return {
            "history": history,
            "today_reviews": history.get(today_key, 0),
            "streak_days": _calculate_streak(history),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/flashcards/{student_id}/review-stats/increment")
async def increment_flashcard_review_stats(student_id: str):
    """Increment today's review count and return updated streak/history."""
    try:
        today_key = date.today().isoformat()
        row = supabase_service.increment_flashcard_review(
            student_id=student_id,
            review_date=today_key,
        )
        rows = supabase_service.get_flashcard_review_days(student_id)
        history = _build_review_history(rows)

        return {
            "review_day": row,
            "history": history,
            "today_reviews": history.get(today_key, 0),
            "streak_days": _calculate_streak(history),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.patch("/flashcards/{student_id}/{flashcard_id}")
async def update_flashcard(student_id: str, flashcard_id: str, body: FlashcardUpdateRequest):
    """Update one flashcard by id."""
    try:
        updates = {
            key: value
            for key, value in {
                "subject": body.subject.strip() if isinstance(body.subject, str) else body.subject,
                "question": body.question.strip() if isinstance(body.question, str) else body.question,
                "answer": body.answer.strip() if isinstance(body.answer, str) else body.answer,
                "mastered": body.mastered,
            }.items()
            if value is not None
        }

        if not updates:
            raise HTTPException(status_code=400, detail="At least one field is required")

        row = supabase_service.update_flashcard(student_id, flashcard_id, updates)
        if not row:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        return {
            "flashcard": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.delete("/flashcards/{student_id}/{flashcard_id}")
async def delete_flashcard(student_id: str, flashcard_id: str):
    """Delete one flashcard."""
    try:
        deleted = supabase_service.delete_flashcard(student_id, flashcard_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Flashcard not found")

        return {
            "flashcard_id": flashcard_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.get("/schedule/{student_id}")
async def get_schedule(student_id: str):
    """Fetch all custom schedule events for a student."""
    try:
        rows = supabase_service.get_schedule_events(student_id)
        return {
            "events": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/schedule")
async def create_schedule(body: ScheduleEventCreateRequest):
    """Create one custom schedule event in Supabase."""
    try:
        title = body.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Event title is required")

        start_time = body.start_time.strip()
        end_time = body.end_time.strip()
        if start_time == end_time:
            raise HTTPException(status_code=400, detail="Start and end time cannot be the same")

        priority = body.priority if body.priority in {"normal", "high"} else "normal"

        row = supabase_service.create_schedule_event(
            student_id=body.student_id,
            title=title,
            subject=(body.subject.strip() or "General"),
            date=body.date,
            start_time=start_time,
            end_time=end_time,
            priority=priority,
        )

        return {
            "event": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.delete("/schedule/{student_id}/{event_id}")
async def delete_schedule(student_id: str, event_id: str):
    """Delete one custom schedule event."""
    try:
        deleted = supabase_service.delete_schedule_event(student_id, event_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Schedule event not found")

        return {
            "event_id": event_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.get("/workspaces/{student_id}")
async def get_workspaces(student_id: str):
    """Fetch student workspaces and auto-create default if none exists."""
    try:
        rows = supabase_service.get_workspaces(student_id)
        if not rows:
            created = supabase_service.create_workspace(student_id=student_id, name="General")
            rows = [created]

        return {
            "workspaces": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/workspaces")
async def create_workspace(body: WorkspaceCreateRequest):
    """Create one workspace for a student."""
    try:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Workspace name is required")

        existing = supabase_service.get_workspaces(body.student_id)
        duplicate = any((row.get("name", "").strip().lower() == name.lower()) for row in existing)
        if duplicate:
            raise HTTPException(status_code=409, detail="Workspace already exists")

        row = supabase_service.create_workspace(
            student_id=body.student_id,
            name=name,
            workspace_id=body.workspace_id,
        )

        return {
            "workspace": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.get("/workspaces/{student_id}/documents")
async def get_workspace_documents(student_id: str):
    """Fetch workspace-document links, with legacy backfill for missing links."""
    try:
        rows = supabase_service.get_workspace_document_links(student_id)

        # Legacy migration path: older accounts may have documents that were never
        # linked into `workspace_documents`. Backfill only missing links.
        documents = supabase_service.get_documents(student_id)
        if documents:
            linked_document_ids = {
                str(link.get("document_id") or "").strip()
                for link in rows
                if str(link.get("document_id") or "").strip()
            }

            missing_doc_ids = []
            for doc in documents:
                doc_id = str(doc.get("id") or "").strip()
                if doc_id and doc_id not in linked_document_ids:
                    missing_doc_ids.append(doc_id)

            if missing_doc_ids:
                workspaces = supabase_service.get_workspaces(student_id)

                if not workspaces:
                    try:
                        supabase_service.create_workspace(student_id=student_id, name="General")
                    except Exception:
                        # Ignore race/duplicate and re-fetch below.
                        pass
                    workspaces = supabase_service.get_workspaces(student_id)

                if workspaces:
                    # Keep migration stable by favoring the first linked workspace;
                    # otherwise use the oldest workspace.
                    target_workspace_id = (
                        str(rows[0].get("workspace_id") or "").strip() if rows else ""
                    )
                    if not target_workspace_id:
                        target_workspace_id = str(workspaces[0]["id"])

                    for doc_id in missing_doc_ids:
                        supabase_service.assign_workspace_document(
                            student_id=student_id,
                            workspace_id=target_workspace_id,
                            document_id=doc_id,
                        )

                    rows = supabase_service.get_workspace_document_links(student_id)

        return {
            "links": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.delete("/workspaces/{student_id}/{workspace_id}")
async def delete_workspace(student_id: str, workspace_id: str):
    """Delete one workspace and keep at least one workspace remaining."""
    try:
        rows = supabase_service.get_workspaces(student_id)
        if len(rows) <= 1 and any(str(row.get("id")) == str(workspace_id) for row in rows):
            raise HTTPException(status_code=400, detail="At least one workspace must remain")

        deleted = supabase_service.delete_workspace(student_id, workspace_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Workspace not found")

        return {
            "workspace_id": workspace_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)


@router.post("/workspaces/{student_id}/{workspace_id}/documents/{document_id}")
async def add_document_to_workspace(student_id: str, workspace_id: str, document_id: str):
    """Assign one document to a workspace."""
    try:
        row = supabase_service.assign_workspace_document(student_id, workspace_id, document_id)
        return {
            "link": row,
            "status": "success",
        }
    except Exception as e:
        _raise_study_data_error(e)


@router.delete("/workspaces/{student_id}/{workspace_id}/documents/{document_id}")
async def remove_document_from_workspace(student_id: str, workspace_id: str, document_id: str):
    """Remove one workspace-document assignment."""
    try:
        deleted = supabase_service.remove_workspace_document(student_id, workspace_id, document_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Workspace document link not found")

        return {
            "workspace_id": workspace_id,
            "document_id": document_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_study_data_error(e)
