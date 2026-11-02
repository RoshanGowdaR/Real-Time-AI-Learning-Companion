"""Chat routes"""
import re
from fastapi import APIRouter, HTTPException, Query

from models.schemas import ChatRequest
from services import supabase_service
from services.llm_service import answer_question, extract_info_llm
from services.rag_service import query_rag
from services.ml_models_service import predict_student_intent, load_find_s_hypothesis

router = APIRouter()

# Patterns that indicate the user explicitly wants PDF/Notes-grounded answers
_PDF_INTENT_PATTERNS = [
    r"according to (the |my )?pdf",
    r"according to pdf",
    r"according to (the |my )?notes",
    r"according to notes",
    r"from (the |my )?pdf",
    r"from (the |my )?notes",
    r"from notes",
    r"in (the |my )?pdf",
    r"in (the |my )?notes",
    r"in notes",
    r"present in (the |my )?pdf",
    r"present in pdf",
    r"present in (the |my )?notes",
    r"present in notes",
    r"using (the |my )?pdf",
    r"using (the |my )?notes",
    r"using notes",
    r"just use (the |my )?pdf",
    r"just use (the |my )?notes",
    r"only use (the |my )?pdf",
    r"only use (the |my )?notes",
    r"based on (the |my )?pdf",
    r"based on (the |my )?notes",
    r"from (my |the )?uploaded",
    r"based on (the |my )?uploaded",
    r"from (the |my )?uploaded",
    r"according to (the |my )?uploaded",
    r"present in (the |my )?uploaded",
    r"tell me from (the |my )?pdf",
    r"tell me from (the |my )?notes",
    r"explain according to (the |my )?pdf",
    r"explain according to (the |my )?notes",
    r"answer from (the |my )?pdf",
    r"answer from (the |my )?notes",
    r"use the pdf to",
    r"use (the |my )?pdf",
    r"use (the |my )?notes",
    r"use (the |my )?resources",
    r"using uploaded",
    r"from uploaded",
]


def _detect_pdf_intent(question: str) -> bool:
    """Return True if the user's question explicitly requests PDF/Notes-grounded answers."""
    q_lower = question.strip().lower()
    for pattern in _PDF_INTENT_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False


@router.post("/chat/extract")
async def extract_chat_info(body: ChatRequest):
    """Extract schedule info from chat text using LLM."""
    try:
        question = body.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")

        info = extract_info_llm(
            question,
            client_local_date=body.client_local_date,
            client_local_time=body.client_local_time,
        )
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
    """Answer question using RAG context and LLM with conversation history."""
    try:
        # 1. RAG retrieval
        rag_context = query_rag(
            question=body.question,
            student_id=body.student_id,
            document_name=body.document_name,
            active_notes=body.active_notes,
        )

        # 2. Combine with active workspace notes if provided by the client
        combined_parts = []
        if body.active_notes and body.active_notes.strip():
            doc_title = body.document_name or "Uploaded Document Notes"
            combined_parts.append(
                f"[📄 Content from Active Uploaded Resource / Notes: {doc_title}]\n{body.active_notes.strip()}"
            )

        if rag_context and rag_context.strip():
            # Avoid duplicating active_notes if already present
            if not body.active_notes or rag_context.strip() not in body.active_notes:
                combined_parts.append(f"[📄 Additional Retrieved Material]:\n{rag_context.strip()}")

        context = "\n\n".join(combined_parts).strip()

        # Detect if user explicitly wants PDF-based answers
        pdf_mode = _detect_pdf_intent(body.question)

        # If user explicitly asks for PDF answers but no context was found, try harder
        if pdf_mode and not context.strip():
            # Re-attempt RAG with a simplified query
            simplified = re.sub(
                r"(according to |from |in |using |based on |just use |only use )?(the )?(pdf|notes|uploaded|resources|files?|documents?)",
                "", body.question, flags=re.IGNORECASE
            ).strip()
            if simplified and len(simplified) >= 3:
                context = query_rag(
                    simplified,
                    body.student_id,
                    document_name=body.document_name,
                    active_notes=body.active_notes,
                )
                if body.active_notes and body.active_notes.strip():
                    context = f"[📄 Content from Active Uploaded Resource / Notes: {body.document_name or 'Uploaded Document'}]\n{body.active_notes.strip()}\n\n{context}".strip()

        # Predict student intent using pre-trained ML model (rf_model.pkl)
        intent = predict_student_intent(body.question)

        # Prioritize conversation history from active client session
        conversation_history = []
        if body.conversation_history and isinstance(body.conversation_history, list):
            for entry in body.conversation_history:
                if not isinstance(entry, dict):
                    continue
                r = entry.get("role")
                c = (entry.get("content") or "").strip()
                if r in ("user", "assistant", "student") and c:
                    role_normalized = "user" if r in ("user", "student") else "assistant"
                    conversation_history.append({"role": role_normalized, "content": c})

        # If not provided by client, load recent messages from database
        if not conversation_history:
            try:
                recent_msgs = supabase_service.get_chat_messages(
                    student_id=body.student_id, limit=10
                )
                # Messages come in desc order (newest first), reverse for chronological
                for msg in reversed(recent_msgs):
                    q = (msg.get("question") or "").strip()
                    a = (msg.get("answer") or "").strip()
                    if q and a:
                        conversation_history.append({"role": "user", "content": q})
                        conversation_history.append({"role": "assistant", "content": a})
            except Exception as hist_err:
                print(f"[Chat] Could not load history from DB: {hist_err}")

        answer = answer_question(
            question=body.question,
            context=context,
            student_id=body.student_id,
            emotion=body.emotion,
            conversation_history=conversation_history,
            intent=intent,
            pdf_mode=pdf_mode,
        )

        source = body.source if body.source in {"text", "voice"} else "text"
        log_row = supabase_service.save_chat_message(
            student_id=body.student_id,
            question=body.question,
            answer=answer,
            source=source,
        )

        find_s_profile = load_find_s_hypothesis()

        return {
            "answer": answer,
            "chat_id": log_row["id"],
            "intent": intent,
            "hypothesis": find_s_profile,
            "pdf_mode": pdf_mode,
            "has_pdf_context": bool(context.strip()),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/talks/{student_id}")
@router.get("/chat/talks/{student_id}")
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
