"""LLM service - Groq Chat for notes, Q&A, greetings, emotion adaptation, schedule extraction, and Version Space hypothesis tailoring."""
import json
import re
from datetime import datetime, timedelta
from typing import Optional
from langchain_groq import ChatGroq

from config import GROQ_API_KEY, get_next_groq_api_key, get_all_groq_keys
from services.version_space_service import get_hypothesis_prompt_instruction

_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

# Groq free tier has ~8000 TPM limit. Reserve tokens for system prompt + response.
_MAX_CONTEXT_CHARS_NOTES = 3000   # ~750 tokens for notes generation
_MAX_CONTEXT_CHARS_CHAT = 2500    # ~625 tokens for chat (leaves room for history)
_MAX_HISTORY_MESSAGES = 6         # 3 exchanges max


def _truncate_text(text: str, max_chars: int) -> str:
    """Truncate text to max_chars, breaking at last sentence/paragraph boundary."""
    if not text or len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Try to break at last paragraph or sentence
    for sep in ['\n\n', '\n', '. ', '! ', '? ']:
        last_break = truncated.rfind(sep)
        if last_break > max_chars * 0.5:
            return truncated[:last_break + len(sep)] + '\n[... context truncated to fit model limits ...]'
    return truncated + '\n[... context truncated to fit model limits ...]'


def _create_llm(model_name: str = _MODELS[0], api_key: Optional[str] = None):
    key = api_key or get_next_groq_api_key()
    return ChatGroq(
        api_key=key,
        model=model_name,
        temperature=0.7,
    )


llm = _create_llm()


def _safe_invoke(messages):
    """Invoke LLM with round-robin key distribution and automatic fallback on token limits/errors."""
    available_keys = get_all_groq_keys()
    start_key = get_next_groq_api_key()

    # Sort keys starting from round-robin key, followed by others
    rotated_keys = [start_key] + [k for k in available_keys if k != start_key]

    for model_name in _MODELS:
        for key in rotated_keys:
            try:
                active_llm = _create_llm(model_name=model_name, api_key=key)
                response = active_llm.invoke(messages)
                if response and response.content:
                    return response.content
            except Exception as e:
                err_msg = str(e).lower()
                print(f"[LLM] Key ...{key[-6:]} with model {model_name} failed: {e}. Rotating to next key...")
                continue

    # Graceful fallback response if all keys/models temporarily fail
    return "I'm having trouble reaching the AI model right now, but I'm here with you. Please review your notes or try again shortly!"



def _safe_string(value, fallback=""):
    text = str(value or "").strip()
    return text or fallback


def _extract_relative_day_offset(source_text: str):
    lowered = str(source_text or "").lower()

    if re.search(r"\bday\s+after\s+tomorrow\b", lowered):
        return 2

    if re.search(r"\btomorrow\b", lowered):
        return 1

    if re.search(r"\btoday\b|\btonight\b", lowered):
        return 0

    return None


def _resolve_client_now(client_local_date: str | None, client_local_time: str | None):
    date_text = str(client_local_date or "").strip()
    if not date_text:
        return None

    parsed_date = None
    date_formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(date_text, fmt).date()
            break
        except ValueError:
            continue

    if parsed_date is None:
        return None

    normalized_time = _normalize_time(str(client_local_time or ""), "")
    if normalized_time:
        try:
            parsed_time = datetime.strptime(normalized_time, "%H:%M").time()
        except ValueError:
            parsed_time = datetime.now().time().replace(second=0, microsecond=0)
    else:
        parsed_time = datetime.now().time().replace(second=0, microsecond=0)

    return datetime.combine(parsed_date, parsed_time)


def _normalize_priority(value):
    return "high" if str(value or "").strip().lower() == "high" else "normal"


def _normalize_date(raw_date: str, base_now: datetime) -> str:
    text = str(raw_date or "").strip().lower()
    if not text:
        return base_now.strftime("%Y-%m-%d")

    if text == "today":
        return base_now.strftime("%Y-%m-%d")

    if text == "tomorrow":
        return (base_now + timedelta(days=1)).strftime("%Y-%m-%d")

    date_formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]
    for fmt in date_formats:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return base_now.strftime("%Y-%m-%d")


def _normalize_time(raw_time: str, fallback_time: str) -> str:
    text = str(raw_time or "").strip().lower().replace(".", "")
    if not text:
        return fallback_time

    direct_formats = [
        "%H:%M",
        "%H",
        "%I:%M %p",
        "%I %p",
    ]
    for fmt in direct_formats:
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", text)
    if not match:
        return fallback_time

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridian = (match.group(3) or "").lower()

    if meridian == "pm" and hour < 12:
        hour += 12
    elif meridian == "am" and hour == 12:
        hour = 0

    if hour > 23 or minute > 59:
        return fallback_time

    return f"{hour:02d}:{minute:02d}"


def _plus_one_hour(time_24h: str) -> str:
    try:
        parsed = datetime.strptime(time_24h, "%H:%M")
        return (parsed + timedelta(hours=1)).strftime("%H:%M")
    except ValueError:
        return "10:00"


def _extract_json_payload(content: str):
    normalized = content.strip()
    if normalized.startswith("```"):
        normalized = normalized.split("```", maxsplit=2)[1]
        if normalized.lstrip().startswith("json"):
            normalized = normalized.lstrip()[4:]
        normalized = normalized.strip()

    try:
        return json.loads(normalized)
    except Exception:
        pass

    # If model adds explanation text around JSON, extract first object block.
    match = re.search(r"\{[\s\S]*\}", normalized)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return {}


def _sanitize_schedule_info(raw_info: dict, source_text: str, base_now: datetime) -> dict:
    info = raw_info if isinstance(raw_info, dict) else {}

    default_start = (base_now + timedelta(hours=1)).strftime("%H:%M")
    start_time = _normalize_time(info.get("start_time") or info.get("startTime"), default_start)
    end_time = _normalize_time(info.get("end_time") or info.get("endTime"), _plus_one_hour(start_time))
    if end_time == start_time:
        end_time = _plus_one_hour(start_time)

    subject = _safe_string(info.get("subject"), "General")
    if subject.lower() in {"this", "that", "subject", "session", "study"}:
        subject = "General"

    raw_title = _safe_string(info.get("title"))
    title = raw_title if raw_title else f"{subject} Study Session"
    if len(title) > 120:
        title = title[:120].rstrip()

    relative_day_offset = _extract_relative_day_offset(source_text)
    if relative_day_offset is not None:
        resolved_date = (base_now + timedelta(days=relative_day_offset)).strftime("%Y-%m-%d")
    else:
        resolved_date = _normalize_date(info.get("date"), base_now)

    return {
        "title": title,
        "subject": subject,
        "date": resolved_date,
        "start_time": start_time,
        "end_time": end_time,
        "priority": _normalize_priority(info.get("priority")),
    }


def extract_info_llm(
    text: str,
    client_local_date: str | None = None,
    client_local_time: str | None = None,
) -> dict:
    """Extract schedule event info from text using LLM."""
    now = _resolve_client_now(client_local_date, client_local_time) or datetime.now()
    current_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")

    system = (
        "You are StudyBuddy — a scheduling assistant. "
        "Extract event details from the user's text into a strict JSON format.\n"
        f"CONTEXT: Today is {current_date}, current time is {current_time}.\n"
        "FIELDS:\n"
        "- title: short descriptive string (e.g., 'Math Revision')\n"
        "- subject: string (e.g., 'Math', 'Physics' or 'General')\n"
        "- date: YYYY-MM-DD format. If they say 'tomorrow', calculate based on today.\n"
        "- start_time: HH:MM format (24h). If not mentioned, default to 1 hour from now.\n"
        "- end_time: HH:MM format (24h). If not mentioned, default to 1 hour after start_time.\n"
        "- priority: 'normal' or 'high'. Default 'normal'.\n"
        "Output ONLY valid JSON."
    )
    messages = [("system", system), ("human", text)]
    try:
        response = llm.invoke(messages)
        content = str(response.content or "")
        parsed = _extract_json_payload(content)
        return _sanitize_schedule_info(parsed, text, now)
    except Exception as e:
        print(f"Error extracting info: {e}")
        return _sanitize_schedule_info({}, text, now)


def generate_notes(text: str) -> str:
    """Convert text into structured study notes."""
    truncated = _truncate_text(text, _MAX_CONTEXT_CHARS_NOTES)
    system = (
        "You are StudyBuddy — a smart AI study companion. "
        "Convert the provided text into well-structured study notes using:\n"
        "- Clear section headings\n"
        "- Bullet points for key concepts\n"
        "- Key terms in **bold**\n"
        "- A 2-3 sentence summary at the end.\n"
        "Be concise and student-friendly."
    )
    messages = [("system", system), ("human", truncated)]
    return _safe_invoke(messages)


def answer_question(
    question: str,
    context: str,
    student_id: Optional[str] = None,
    emotion: Optional[str] = None,
    conversation_history: Optional[list] = None,
    intent: Optional[str] = None,
    pdf_mode: bool = False,
) -> str:
    """Answer student questions adapting to detected emotion, RF predicted intent, and Find-S hypothesis.
    
    Includes recent conversation history so the LLM remembers prior exchanges.
    When pdf_mode=True, forces strict PDF extraction + simple explanation format.
    """
    # Emotion adaptation instructions
    emotion_instruction = ""
    normalized_emotion = str(emotion or "").strip().lower()
    if normalized_emotion in ("confused", "surprise", "surprised"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: CONFUSED / SURPRISED 😕]\n"
            "- The student is visibly confused. Break down the concept into simpler fundamental building blocks.\n"
            "- Use an intuitive everyday metaphor before technical jargon.\n"
            "- Gently ask if this clarification helps."
        )
    elif normalized_emotion in ("sad",):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: SAD / DISCOURAGED 😢]\n"
            "- The student appears tired or discouraged. Be extraordinarily warm, compassionate, and reassuring.\n"
            "- Keep the explanation low-stress, celebrate small wins, and break the topic into small digestible bites."
        )
    elif normalized_emotion in ("angry", "distressed", "frustrated"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: FRUSTRATED / OVERWHELMED 😠]\n"
            "- The student appears frustrated. Validate that this topic is genuinely tricky.\n"
            "- Slow down the pace, remove unnecessary jargon, and offer a calm, friendly step-by-step breakdown."
        )
    elif normalized_emotion in ("fear", "anxious", "fearful"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: ANXIOUS / WORRIED 😨]\n"
            "- The student appears anxious about understanding the topic or exam.\n"
            "- Provide reassuring encouragement, clearly state the most high-yield core idea first, and build their confidence."
        )
    elif normalized_emotion in ("disgust", "displeased"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: TEDIOUS / DISPLEASED 😖]\n"
            "- The topic might feel dry or tedious. Switch up the angle with a fun, engaging real-world application."
        )
    elif normalized_emotion in ("happy", "excited"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: HAPPY / CONFIDENT 😊]\n"
            "- The student is feeling confident and positive! Match their enthusiastic energy.\n"
            "- Celebrate their great progress and provide an interesting deeper insight."
        )
    elif normalized_emotion in ("neutral", "focused"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: FOCUSED 😐]\n"
            "- The student is focused and locked in. Provide clean, well-structured, directly relevant points."
        )
    elif normalized_emotion in ("sleeping", "drowsy"):
        emotion_instruction = (
            "\n[ACTIVE EMOTION DETECTED: SLEEPING / DROWSY 😴]\n"
            "- The student was detected falling asleep or dozing off.\n"
            "- Start with an energetic, motivating wake-up greeting (e.g. encouraging them to stretch or splash water).\n"
            "- Keep the answer punchy, high-energy, and ask a quick interactive question to get their mind buzzing again."
        )

    # ML model predicted intent instructions (from models/rf_model.pkl)
    intent_instruction = ""
    if intent:
        norm_intent = str(intent).strip().lower()
        if norm_intent == "confused":
            intent_instruction = (
                "\n[PREDICTED STUDENT INTENT: CONFUSED (via rf_model)]\n"
                "- The student's inquiry indicates they may be confused or struggling. Simplify foundational ideas and break explanations down step by step."
            )
        elif norm_intent == "advanced":
            intent_instruction = (
                "\n[PREDICTED STUDENT INTENT: ADVANCED (via rf_model)]\n"
                "- The student is exploring advanced or deeper concepts. Provide thorough technical depth, edge cases, and high-level conceptual clarity."
            )
        elif norm_intent == "on-track":
            intent_instruction = (
                "\n[PREDICTED STUDENT INTENT: ON-TRACK (via rf_model)]\n"
                "- The student is progressing well on track. Deliver crisp, clear, and structured study guidance."
            )

    # Find-S hypothesis instructions from models/hypothesis.json
    find_s_instruction = ""
    try:
        from services.ml_models_service import load_find_s_hypothesis
        find_s_h = load_find_s_hypothesis()
        if find_s_h:
            guidelines = []
            if str(find_s_h.get("used_examples", "")).lower() in ("true", "1", "yes"):
                guidelines.append("Always include vivid real-world examples and intuitive analogies.")
            depth_val = find_s_h.get("response_depth")
            if depth_val and depth_val != "?":
                guidelines.append(f"Calibrated response depth preference: {depth_val}.")
            intent_val = find_s_h.get("intent")
            if intent_val and intent_val != "?":
                guidelines.append(f"Calibrated student comprehension intent: {intent_val}.")
            emotion_val = find_s_h.get("emotion")
            if emotion_val and emotion_val != "?":
                guidelines.append(f"Calibrated emotional comfort zone: {emotion_val}.")
            if guidelines:
                find_s_instruction = (
                    "\n[LEARNED FIND-S HYPOTHESIS PREFERENCES (From student's positive feedback in models/hypothesis.json)]:\n"
                    + "\n".join(f"- {g}" for g in guidelines)
                    + "\nStrictly respect these learned preferences."
                )
    except Exception as e:
        print(f"[Find-S] Error fetching hypothesis in LLM service: {e}")

    # Version Space hypothesis instructions derived from feedback
    hypothesis_instruction = ""
    if student_id:
        try:
            hp = get_hypothesis_prompt_instruction(student_id)
            if hp:
                hypothesis_instruction = (
                    f"\n[ADAPTIVE TEACHING APPROACH (Learned via Version Space Algorithm from student's past session feedback)]:\n"
                    f"{hp}\n"
                    f"STRICTLY follow these personalized teaching preferences while answering."
                )
        except Exception as e:
            print(f"[VersionSpace] Error fetching hypothesis: {e}")

    # PDF mode specific instructions
    pdf_mode_instruction = ""
    if pdf_mode:
        if context.strip():
            pdf_mode_instruction = (
                "\n[🔒 PDF-ONLY MODE ACTIVATED — The student EXPLICITLY requested answers from their uploaded PDF]\n"
                "You MUST follow this format EXACTLY:\n"
                "### 📄 Answer from Uploaded PDF\n"
                "(Extract the EXACT relevant information, definitions, facts, and details directly from the Uploaded PDF Context below. "
                "Quote or closely paraphrase the PDF content. Do NOT add outside knowledge in this section.)\n\n"
                "### 💡 In Simple Words\n"
                "(Now explain the above PDF answer in simple, crystal-clear everyday language. Use intuitive analogies and "
                "accessible wording so the student grasps the concept easily.)\n\n"
                "CRITICAL: You MUST use BOTH sections above. First give the PDF answer, then the simple explanation.\n"
            )
        else:
            pdf_mode_instruction = (
                "\n[⚠️ PDF MODE REQUESTED BUT NO PDF CONTEXT FOUND]\n"
                "The student asked for answers from their uploaded PDF, but no matching content was found in their uploaded documents.\n"
                "You MUST start your response with: '⚠️ **This topic was not found in your uploaded PDF.**'\n"
                "Then provide a helpful, clear explanation using your tutor knowledge.\n"
            )

    system = (
        "You are Sensei — a warm, highly conversational AI study tutor for students.\n\n"
        "CORE RULES:\n"
        "1. CONVERSATION CONTEXT IS PARAMOUNT: You MUST pay close attention to the CONVERSATION HISTORY below. "
        "The student may refer back to previous messages (e.g., 'yes', 'tell me in general', 'explain that further', "
        "'what about trees?', etc.). Always infer what they mean from the prior exchanges and continue seamlessly.\n"
        "2. NEVER STALL OR ASK PERMISSION: If there is no uploaded PDF context (context is empty), NEVER ask "
        "'Do you want me to explain this in general or upload a PDF?'. IMMEDIATELY explain the topic using your rich, "
        "expert academic knowledge clearly and directly!\n"
        "3. NEVER REPEAT QUESTIONS: If the student answered 'yes' or 'tell me in general', provide the explanation "
        "straight away. DO NOT ask which topic they need again.\n"
        "4. RAG & UPLOADED RESOURCE RULES (STRICT & MANDATORY):\n"
        "   - Whenever uploaded PDF context is provided, OR whenever the student asks questions asking for answers "
        "'according to the pdf', 'from the pdf', 'from the notes', or 'using uploaded resources':\n"
        "     * FIRST: Extract the direct, accurate answer/definition directly from the uploaded PDF text:\n"
        "       ### 📄 Answer from Uploaded PDF\n"
        "       (Accurate facts, definitions, and details extracted directly from the uploaded material)\n"
        "     * SECOND: Immediately explain that answer in simple, crystal-clear words:\n"
        "       ### 💡 In Simple Words\n"
        "       (Clear, simple breakdown using everyday analogies and accessible language so the student grasps the intuition easily)\n"
        "   - If the student specifies 'just use the pdf to give answers' or 'only use the pdf':\n"
        "     * Strictly restrict the factual answer to only what is present in the Uploaded PDF Context. Do not introduce outside concepts.\n"
        "   - If the student specifically asks for answers from the PDF, but no PDF context is provided (or the topic is not in the uploaded document):\n"
        "     * Clearly inform them: 'This topic was not found in your uploaded PDF.' and then provide a clear, helpful explanation using your tutor knowledge.\n"
        "5. For EXAM prep questions (e.g., 'what to focus on for 5 marks'), give specific, practical advice with high-yield concepts.\n"
        "6. Always format output beautifully using Markdown: use '### Subheadings', bold '**key terms**', bullet points, and code blocks for code/syntax.\n"
        "7. Always end with an encouraging line.\n"
        "8. Keep responses concise and focused (under 250 words unless asked for detailed notes or comprehensive explanations).\n"
        f"{pdf_mode_instruction}\n"
        f"{emotion_instruction}\n"
        f"{intent_instruction}\n"
        f"{find_s_instruction}\n"
        f"{hypothesis_instruction}\n\n"
        f"Uploaded PDF Context:\n{_truncate_text(context, _MAX_CONTEXT_CHARS_CHAT) if context.strip() else '[No PDF uploaded yet]'}"
    )

    # Build multi-turn messages: system → conversation history → current question
    messages = [("system", system)]

    # Inject conversation history as alternating human/ai turns
    if conversation_history:
        # Cap to last few exchanges to stay within Groq's strict token limits
        capped_history = conversation_history[-_MAX_HISTORY_MESSAGES:]
        for entry in capped_history:
            role = entry.get("role", "user")
            content = entry.get("content", "")
            if not content:
                continue
            if role == "user":
                messages.append(("human", content))
            elif role == "assistant":
                messages.append(("ai", content))

    # Add the current question
    messages.append(("human", question))
    return _safe_invoke(messages)


def search_and_synthesize(query: str, search_type: str) -> str:
    """Simulate web/research search and synthesize into notes via LLM."""
    type_label = "Deep Academic Research" if search_type == "research" else "Web Search"
    system = (
        f"You are StudyBuddy — an expert researcher. Use your knowledge to simulate a {type_label} result.\n"
        "Convert your simulated findings into well-structured study notes using:\n"
        "- Clear section headings\n"
        "- Bullet points for key concepts\n"
        "- Key terms in **bold**\n"
        "- A 2-3 sentence summary at the end.\n"
        "Focus on providing high-quality, accurate educational content."
    )
    user_msg = f"Simulate a {search_type} for: {query}"
    messages = [("system", system), ("human", user_msg)]
    return _safe_invoke(messages)


def generate_greeting(student_name: str, recent_sessions: list) -> str:
    """Generate a warm, personalized greeting for the student."""
    has_sessions = len(recent_sessions) > 0
    session_info = ""
    if has_sessions:
        topics = [s.get("topics_covered", []) for s in recent_sessions]
        flat_topics = [t for sub in topics for t in sub]
        session_info = f"Their recent study topics were: {', '.join(flat_topics[:5])}." if flat_topics else ""

    system = "You are Sensei, a warm and encouraging AI study companion for students."
    user_msg = (
        f"Greet a student named {student_name}. "
        f"{'They are a returning student. ' + session_info if has_sessions else 'This is their first session.'} "
        f"Do the following in order:\n"
        f"1. Welcome them warmly by name.\n"
        f"2. If returning, briefly mention what they studied before and compliment their consistency.\n"
        f"3. Give ONE short (2-sentence) motivational message.\n"
        f"4. End with: 'How can I help you today?'\n"
        f"Keep the total response under 80 words. Sound friendly and natural, not robotic."
    )
    messages = [("system", system), ("human", user_msg)]
    res = _safe_invoke(messages)
    if not res or "having trouble reaching" in res:
        return f"Welcome back, {student_name}! Great to see you ready to learn today. What shall we study?"
    return res


def generate_flashcard_answer(question: str, subject: str, context: str = "") -> str:
    """Generate a concise flashcard answer, grounded by context when available."""
    safe_subject = (subject or "General").strip() or "General"

    system = (
        "You are StudyBuddy Flashcard AI. Write a concise, exam-ready answer for a study flashcard.\n"
        "Rules:\n"
        "1. Keep answer short: 2-5 sentences, or brief bullet points when helpful.\n"
        "2. Ground in the provided context if present.\n"
        "3. Focus on what is most likely to earn marks on an exam.\n"
        "4. Do not include markdown headers or greetings."
    )
    user_msg = f"Subject: {safe_subject}\nQuestion: {question}\nContext: {context if context else 'None'}"
    messages = [("system", system), ("human", user_msg)]
    return _safe_invoke(messages)
