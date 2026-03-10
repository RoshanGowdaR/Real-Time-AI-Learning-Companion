"""Upload routes"""
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models.schemas import DocumentUpdateRequest
from services.rag_service import process_pdf, rebuild_student_index
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


@router.get("/documents/{student_id}")
async def get_documents(student_id: str):
    """Return uploaded documents for a student."""
    try:
        rows = supabase_service.get_documents(student_id)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documents/{student_id}/{document_id}")
async def update_document(student_id: str, document_id: str, body: DocumentUpdateRequest):
    """Update document metadata for a student resource."""
    try:
        updates = {
            key: value
            for key, value in {
                "filename": body.filename,
                "summary": body.summary,
            }.items()
            if value is not None
        }

        if not updates:
            raise HTTPException(status_code=400, detail="At least one field is required")

        row = supabase_service.update_document(student_id, document_id, updates)
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "document": row,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{student_id}/{document_id}")
async def delete_document(student_id: str, document_id: str):
    """Delete a student document and rebuild the student's retrieval index."""
    try:
        deleted = supabase_service.delete_document(student_id, document_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found")

        remaining_rows = supabase_service.get_documents(student_id)
        remaining_names = {row.get("filename") for row in remaining_rows if row.get("filename")}

        filename = deleted.get("filename")
        if filename and filename not in remaining_names:
            file_path = UPLOADS_DIR / filename
            if file_path.exists():
                file_path.unlink()

        remaining_paths = [
            str(UPLOADS_DIR / row["filename"])
            for row in remaining_rows
            if row.get("filename")
        ]
        rebuild_student_index(student_id, remaining_paths)

        return {
            "document_id": document_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
