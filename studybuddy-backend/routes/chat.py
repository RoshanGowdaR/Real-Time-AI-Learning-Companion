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

_WEB_INTENT_PATTERNS = [
    r"\bsearch (the )?web\b",
    r"\bfrom (the )?web\b",
    r"\bon (the )?web\b",
    r"\bget (it )?from (the )?web\b",
    r"\bfind (it )?(on|from) (the )?web\b",
    r"\blook (it )?up (on|from) (the )?web\b",
    r"\bweb search\b",
    r"\bsearch online\b",
    r"\bfrom the internet\b",
]

_GREETING_WORDS = {
    "hi", "hello", "hey", "heyy", "hey there", "greetings",
    "good morning", "good afternoon", "good evening", "howdy",
    "sup", "yo", "how are you", "who are you", "what is your name"
}

_AFFIRMATIVE_PHRASES = {
    "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "k",
    "yes please", "sure please", "please", "yes do it", "do it",
    "get it from the web", "search web", "yes search web",
    "yes get it from the web", "find it from the web", "yes find it",
    "yes please get it from the web", "yes tell me from web",
    "get from web", "from web", "go ahead", "alright", "fine", "yes do that"
}

_NEGATIVE_PHRASES = {
    "no", "nah", "nope", "no thanks", "dont search", "don't search",
    "cancel", "never mind", "nevermind", "no need"
}


def _detect_pdf_intent(question: str) -> bool:
    """Return True if the user's question explicitly requests PDF/Notes-grounded answers."""
    q_lower = question.strip().lower()
    for pattern in _PDF_INTENT_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False


def _detect_web_intent(question: str) -> bool:
    """Return True if the user explicitly asks for web search."""
    q_lower = question.strip().lower()
    for pattern in _WEB_INTENT_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False


def _is_greeting(text: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", str(text or "").strip().lower()).strip()
    return clean in _GREETING_WORDS


def _is_affirmative(text: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", str(text or "").strip().lower()).strip()
    if clean in _AFFIRMATIVE_PHRASES:
        return True
    if re.match(r"^(yes|sure|ok|okay|yeah|yep|k)\b.*(web|search|find|explain|tell|please|go ahead|proceed)", clean):
        return True
    return False


def _is_negative(text: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", str(text or "").strip().lower()).strip()
    return clean in _NEGATIVE_PHRASES


def _find_pending_web_caution(conversation_history: list[dict]) -> str | None:
    """
    Search backwards in conversation history for an assistant message that cautioned
    about the topic not being in the uploaded PDF and asked for permission to search the web.
    Returns the student's question that triggered that caution, or None.
    """
    if not conversation_history:
        return None

    for i in range(len(conversation_history) - 1, -1, -1):
        msg = conversation_history[i]
        role = msg.get("role")
        content = str(msg.get("content") or "").lower()

        if role == "assistant" and (
            "not from the uploaded" in content or
            "find and explain the answer from the web" in content or
            "answer from the web for you" in content or
            "this is not from the uploaded" in content
        ):
            for j in range(i - 1, -1, -1):
                prev_msg = conversation_history[j]
                if prev_msg.get("role") in ("user", "student"):
                    q = (prev_msg.get("content") or "").strip()
                    if q and not _is_affirmative(q) and not _is_greeting(q):
                        return q
            break
    return None


def _is_topic_in_context(question: str, context: str) -> bool:
    """
    Check if significant content words from the question appear in the context.
    If none appear, the topic is not discussed in the document context.
    """
    if not context or not context.strip():
        return False

    stop_words = {
        "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
        "explain", "describe", "define", "tell", "about", "according", "from",
        "notes", "pdf", "does", "have", "with", "this", "that", "these", "those",
        "give", "show", "help", "please", "can", "could", "would", "should"
    }
    words = [
        w for w in re.findall(r"\b[a-zA-Z]{3,}\b", question.lower())
        if w not in stop_words
    ]
    if not words:
        return True  # Unable to rule out via keywords

    ctx_lower = context.lower()
    return any(w in ctx_lower for w in words)


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
    """Answer question using RAG context, conversational memory, web search permission, and emotion adaptation."""
    try:
        raw_question = body.question.strip()
        source = body.source if body.source in {"text", "voice"} else "text"
        intent = predict_student_intent(raw_question)
        find_s_profile = load_find_s_hypothesis()
        normalized_emotion = str(body.emotion or "").strip().lower()

        # Build clean conversation history
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

        if not conversation_history and body.student_id:
            try:
                recent_msgs = supabase_service.get_chat_messages(
                    student_id=body.student_id, limit=10
                )
                for msg in reversed(recent_msgs):
                    q = (msg.get("question") or "").strip()
                    a = (msg.get("answer") or "").strip()
                    if q and a:
                        conversation_history.append({"role": "user", "content": q})
                        conversation_history.append({"role": "assistant", "content": a})
            except Exception as hist_err:
                print(f"[Chat] Could not load history from DB: {hist_err}")

        # 1. Handle Greetings warmly (adapting to emotion)
        if _is_greeting(raw_question):
            if normalized_emotion in ("frustrated", "angry", "distressed"):
                greeting_text = (
                    "Hey there! I know studying can feel overwhelming at times, but I'm right here with you. "
                    "Take a deep breath—what would you like to work on together?"
                )
            elif normalized_emotion in ("confused", "surprise"):
                greeting_text = (
                    "Hello! Sensei here. If anything is feeling tricky or confusing, let's break it down step by step. "
                    "What would you like to explore today?"
                )
            elif normalized_emotion in ("sad",):
                greeting_text = (
                    "Hey! It's great to see you. Remember to take it easy on yourself. "
                    "What would you like to explore today?"
                )
            elif normalized_emotion in ("happy", "excited"):
                greeting_text = (
                    "Hey! Love the positive energy! What exciting topic are we tackling today?"
                )
            else:
                greeting_text = (
                    "Hello! Sensei here, ready to help you study. What would you like to explore today?"
                )

            log_row = supabase_service.save_chat_message(
                student_id=body.student_id,
                question=raw_question,
                answer=greeting_text,
                source=source,
            )
            return {
                "answer": greeting_text,
                "chat_id": log_row["id"],
                "intent": intent,
                "hypothesis": find_s_profile,
                "pdf_mode": False,
                "has_pdf_context": False,
                "status": "success",
            }

        # 2. Handle Negatives ("no", "no thanks")
        if _is_negative(raw_question):
            neg_answer = "No problem at all! Let me know what you'd like to focus on from your uploaded notes, or ask whenever you're ready."
            log_row = supabase_service.save_chat_message(
                student_id=body.student_id,
                question=raw_question,
                answer=neg_answer,
                source=source,
            )
            return {
                "answer": neg_answer,
                "chat_id": log_row["id"],
                "intent": intent,
                "hypothesis": find_s_profile,
                "pdf_mode": False,
                "has_pdf_context": False,
                "status": "success",
            }

        # 3. Detect Affirmative / Web Permission flow
        web_mode = False
        pending_web_question = None
        is_isolated_affirmative = False

        if _is_affirmative(raw_question):
            # Check conversation history to see if there's a pending web search caution
            pending_q = _find_pending_web_caution(conversation_history)
            if pending_q:
                web_mode = True
                pending_web_question = pending_q
            else:
                # User said "yes" with no preceding web caution in context
                is_isolated_affirmative = True

        if _detect_web_intent(raw_question):
            web_mode = True

        pdf_mode = _detect_pdf_intent(raw_question)

        # 4. Check if student has uploaded resources
        has_uploaded_resources = bool(
            (body.selected_source_ids and len(body.selected_source_ids) > 0) or
            (body.document_name and body.document_name.strip()) or
            (body.active_notes and body.active_notes.strip())
        )
        if not has_uploaded_resources and body.student_id:
            try:
                docs = supabase_service.get_documents(body.student_id)
                if docs and len(docs) > 0:
                    has_uploaded_resources = True
            except Exception:
                pass

        # 5. RAG Retrieval (when not in web_mode and not isolated affirmative)
        context = ""
        if not web_mode and not is_isolated_affirmative:
            rag_context = query_rag(
                question=raw_question,
                student_id=body.student_id,
                document_name=body.document_name,
                active_notes=body.active_notes,
            )

            combined_parts = []
            if body.active_notes and body.active_notes.strip():
                doc_title = body.document_name or "Uploaded Document Notes"
                combined_parts.append(
                    f"[📄 Content from Active Uploaded Resource / Notes: {doc_title}]\n{body.active_notes.strip()}"
                )

            if rag_context and rag_context.strip():
                if not body.active_notes or rag_context.strip() not in body.active_notes:
                    combined_parts.append(f"[📄 Additional Retrieved Material]:\n{rag_context.strip()}")

            context = "\n\n".join(combined_parts).strip()

            # If user explicitly asked for PDF and no context was found, retry simplified
            if pdf_mode and not context.strip():
                simplified = re.sub(
                    r"(according to |from |in |using |based on |just use |only use )?(the )?(pdf|notes|uploaded|resources|files?|documents?)",
                    "", raw_question, flags=re.IGNORECASE
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

            # 6. Check if topic is present in uploaded documents
            if has_uploaded_resources:
                topic_found = _is_topic_in_context(raw_question, context)
                if not context.strip() or not topic_found:
                    # Absent from uploaded resources -> Caution the user and ask for web permission
                    caution_text = (
                        "⚠️ **This is not from the uploaded PDF/notes.**\n\n"
                        "Would you like me to find and explain the answer from the web for you?"
                    )
                    log_row = supabase_service.save_chat_message(
                        student_id=body.student_id,
                        question=raw_question,
                        answer=caution_text,
                        source=source,
                    )
                    return {
                        "answer": caution_text,
                        "chat_id": log_row["id"],
                        "intent": intent,
                        "hypothesis": find_s_profile,
                        "pdf_mode": pdf_mode,
                        "has_pdf_context": False,
                        "status": "success",
                    }

        # 7. Answer Question with LLM (handles web_mode, isolated affirmative, and context)
        answer = answer_question(
            question=raw_question,
            context=context,
            student_id=body.student_id,
            emotion=body.emotion,
            conversation_history=conversation_history,
            intent=intent,
            pdf_mode=pdf_mode,
            web_mode=web_mode,
            has_uploaded_resources=has_uploaded_resources,
            pending_web_question=pending_web_question,
            is_isolated_affirmative=is_isolated_affirmative,
        )

        log_row = supabase_service.save_chat_message(
            student_id=body.student_id,
            question=raw_question,
            answer=answer,
            source=source,
        )

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
