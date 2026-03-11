"""Chat routes"""
from fastapi import APIRouter, HTTPException, Query

from models.schemas import ChatRequest
from services import supabase_service
from services.llm_service import answer_question, extract_info_llm
from services.rag_service import query_rag

router = APIRouter()


@router.post("/chat/extract")
async def extract_chat_info(body: ChatRequest):
    """Extract schedule info from chat text using LLM."""
    try:
        question = body.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")

        info = extract_info_llm(question)
        return {
            "info": info,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat(body: ChatRequest):
    """Answer question using RAG context and LLM."""
    try:
        context = query_rag(body.question, body.student_id)
        answer = answer_question(body.question, context)

        source = body.source if body.source in {"text", "voice"} else "text"
        log_row = supabase_service.save_chat_message(
            student_id=body.student_id,
            question=body.question,
            answer=answer,
            source=source,
        )

        return {
            "answer": answer,
            "chat_id": log_row["id"],
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/talks/{student_id}")
async def get_talks(student_id: str, limit: int = Query(default=100, ge=1, le=500)):
    """Get recent talk/chat entries for a student."""
    try:
        rows = supabase_service.get_chat_messages(student_id=student_id, limit=limit)
        return {
            "talks": rows,
            "count": len(rows),
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/talks/{student_id}/{talk_id}")
async def delete_talk(student_id: str, talk_id: str):
    """Delete a single talk/chat row by ID."""
    try:
        deleted = supabase_service.delete_chat_message(student_id=student_id, message_id=talk_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Talk not found")

        return {
            "talk_id": talk_id,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/talks/{student_id}")
async def clear_talks(student_id: str):
    """Delete all talks/chats for a student."""
    try:
        deleted_rows = supabase_service.clear_chat_messages(student_id=student_id)
        return {
            "deleted_count": len(deleted_rows),
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
