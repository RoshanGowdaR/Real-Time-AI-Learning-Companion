"""Notes routes"""
from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException

from models.schemas import NotesRequest
from services import supabase_service
from services.llm_service import generate_notes, search_and_synthesize

router = APIRouter()
UPLOADS_DIR = Path("uploads")


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
        if not body.filename:
            raise HTTPException(status_code=400, detail="Filename or search_type is required")

        file_path = UPLOADS_DIR / body.filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        doc = fitz.open(str(file_path))
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()

        if not text.strip():
            raise HTTPException(status_code=400, detail="PDF contains no text")

        notes = generate_notes(text.strip())
        return {"notes": notes, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
