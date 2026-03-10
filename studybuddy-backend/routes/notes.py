"""Notes routes"""
from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException

from models.schemas import NotesRequest
from services.llm_service import generate_notes

router = APIRouter()
UPLOADS_DIR = Path("uploads")


@router.post("/notes/generate")
async def generate_notes_from_document(body: NotesRequest):
    """Extract text from PDF and generate structured notes."""
    try:
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
