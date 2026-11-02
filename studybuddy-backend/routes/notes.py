"""Notes routes"""
import os
from pathlib import Path
from typing import Optional

import fitz
from fastapi import APIRouter, HTTPException

from config import BASE_DIR, UPLOADS_DIR
from models.schemas import NotesRequest
from services import supabase_service
from services.llm_service import generate_notes, search_and_synthesize

router = APIRouter()


def _resolve_pdf_path(filename: Optional[str], document_id: Optional[str], student_id: Optional[str]) -> Optional[Path]:
    """Find the PDF file on disk using multiple fallback strategies."""
    target_name = (filename or "").strip()

    # If document_id exists and student_id is provided, check document in database
    db_doc = None
    if student_id:
        try:
            docs = supabase_service.get_documents(student_id)
            for d in docs:
                if document_id and str(d.get("id")) == str(document_id):
                    db_doc = d
                    if not target_name:
                        target_name = d.get("filename", "").strip()
                    break
                elif target_name and d.get("filename", "").strip().lower() == target_name.lower():
                    db_doc = d
                    break
        except Exception:
            pass

    candidates_dirs = [
        UPLOADS_DIR,
        BASE_DIR / "uploads",
        BASE_DIR.parent / "studybuddy-backend" / "uploads",
        BASE_DIR.parent / "uploads",
        Path("uploads"),
    ]

    if target_name:
        clean_name = Path(target_name).name
        # Strategy 1: Check in candidate directories
        for d in candidates_dirs:
            if d.exists() and d.is_dir():
                p1 = d / clean_name
                if p1.exists() and p1.is_file():
                    return p1
                for f in d.iterdir():
                    if f.is_file() and f.name.lower() == clean_name.lower():
                        return f

        # Strategy 2: Partial matches
        clean_stem = clean_name.lower().replace(".pdf", "").strip()
        for d in candidates_dirs:
            if d.exists() and d.is_dir():
                for f in d.glob("*.pdf"):
                    if clean_stem in f.name.lower() or f.name.lower() in clean_stem:
                        return f

        # Strategy 3: Search recursively in project directory
        for search_root in [BASE_DIR, BASE_DIR.parent]:
            if search_root.exists():
                for p in search_root.rglob("*.pdf"):
                    if p.is_file() and p.name.lower() == clean_name.lower():
                        return p

    return None


@router.post("/notes/generate")
async def generate_notes_from_document(body: NotesRequest):
    """Extract text from PDF or search Web/Research to generate structured notes."""
    try:
        # 1. Handle search requests (Web/Research)
        if body.search_type in {"web", "research"}:
            if not body.query or not body.query.strip():
                raise HTTPException(status_code=400, detail="Search query is required")

            notes = search_and_synthesize(body.query.strip(), body.search_type)
            return {"notes": notes, "status": "success"}

        # 2. Handle PDF file-based requests
        file_path = _resolve_pdf_path(body.filename, body.document_id, body.student_id)
        
        text = ""
        if file_path and file_path.exists():
            try:
                doc = fitz.open(str(file_path))
                for page in doc:
                    text += page.get_text()
                doc.close()
            except Exception as read_err:
                text = ""

        # Fallback to database summary if text is empty or file not found
        if not text.strip() and body.student_id:
            try:
                docs = supabase_service.get_documents(body.student_id)
                matched = None
                for d in docs:
                    if body.document_id and str(d.get("id")) == str(body.document_id):
                        matched = d
                        break
                    if body.filename and d.get("filename", "").lower() == body.filename.lower():
                        matched = d
                        break
                if matched and matched.get("summary"):
                    text = f"Title: {matched.get('filename')}\nSummary:\n{matched.get('summary')}"
            except Exception:
                pass

        # Fallback to synthesis based on filename if still empty
        if not text.strip():
            topic_title = body.filename or "Study Material"
            clean_title = topic_title.replace(".pdf", "").replace("_", " ").strip()
            notes = search_and_synthesize(clean_title, "research")
            return {"notes": notes, "status": "success"}

        notes = generate_notes(text.strip())
        return {"notes": notes, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

