"""Upload routes"""
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.rag_service import process_pdf
from services import supabase_service

router = APIRouter()
UPLOADS_DIR = Path("uploads")


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    student_id: str = Form(...),
):
    """Accept PDF upload, process with RAG, save document to Supabase."""
    try:
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="PDF file required")

        file_path = UPLOADS_DIR / file.filename
        contents = await file.read()
        file_path.write_bytes(contents)

        summary = process_pdf(str(file_path), student_id)
        row = supabase_service.save_document(
            student_id=student_id,
            filename=file.filename,
            summary=summary,
        )

        return {
            "document_id": row["id"],
            "filename": file.filename,
            "summary": summary,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
