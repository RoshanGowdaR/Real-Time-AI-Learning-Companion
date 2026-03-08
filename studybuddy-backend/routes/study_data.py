"""Study data routes for flashcards, schedules, and workspaces."""
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from models.schemas import (
    FlashcardCreateRequest,
    FlashcardUpdateRequest,
    ScheduleEventCreateRequest,
    WorkspaceCreateRequest,
)
from services import supabase_service

router = APIRouter()


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/flashcards/{student_id}/review-stats/increment")
async def increment_flashcard_review_stats(student_id: str):
    """Increment today's review count and return updated streak/history."""
    try:
        today_key = date.today().isoformat()
        row = supabase_service.increment_flashcard_review(student_id=student_id, review_date=today_key)
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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedule")
async def create_schedule(body: ScheduleEventCreateRequest):
    """Create one custom schedule event in Supabase."""
    try:
        title = body.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Event title is required")

        priority = body.priority if body.priority in {"normal", "high"} else "normal"

        row = supabase_service.create_schedule_event(
            student_id=body.student_id,
            title=title,
            subject=(body.subject.strip() or "General"),
            date=body.date,
            start_time=body.start_time,
            end_time=body.end_time,
            priority=priority,
        )

        return {
            "event": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspaces/{student_id}/documents")
async def get_workspace_documents(student_id: str):
    """Fetch all workspace-document links for a student."""
    try:
        rows = supabase_service.get_workspace_document_links(student_id)
        return {
            "links": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))
