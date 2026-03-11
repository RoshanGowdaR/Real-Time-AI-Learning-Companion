"""LLM service - Groq Chat for notes, Q&A, greetings"""
import json
import re
from datetime import datetime, timedelta

from langchain_groq import ChatGroq

from config import GROQ_API_KEY

# LangChain Groq client used for both study chat and structured extraction flows.
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
)


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
    system = (
        "You are StudyBuddy — a smart AI study companion. "
        "Convert the provided text into well-structured study notes using:\n"
        "- Clear section headings\n"
        "- Bullet points for key concepts\n"
        "- Key terms in **bold**\n"
        "- A 2-3 sentence summary at the end.\n"
        "Be concise and student-friendly."
    )
    messages = [("system", system), ("human", text)]
    response = llm.invoke(messages)
    return response.content


def answer_question(question: str, context: str) -> str:
    """Answer student questions based on uploaded PDF context or general knowledge."""
    system = (
        "You are Sensei — a warm, conversational AI study assistant for students.\n\n"
        "RULES:\n"
        "1. If the student's question is VAGUE (e.g., 'give me study strategy' without specifying topic), "
        "ASK a clarifying question first. Example: 'Sure! Which subject or topic would you like strategy for?'\n"
        "2. If the user asks about a SUBJECT and there is relevant context from their uploaded PDF, use it.\n"
        "3. If there is NO uploaded PDF context (context is empty), tell the student: "
        "'I don't see any study material uploaded for this topic. Would you like to upload your notes so I can "
        "give you targeted help? Or I can suggest based on the general syllabus.'\n"
        "4. For EXAM prep questions (e.g., 'what to focus on for 5 marks'), give specific, practical advice.\n"
        "5. Always end with an encouraging line.\n"
        "6. Keep responses under 150 words unless asked for detailed notes.\n\n"
        f"Uploaded PDF Context:\n{context if context.strip() else '[No PDF uploaded yet]'}"
    )
    user_msg = f"Student: {question}"
    messages = [("system", system), ("human", user_msg)]
    response = llm.invoke(messages)
    return response.content


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
    response = llm.invoke(messages)
    return response.content


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
    response = llm.invoke(messages)
    return response.content


def generate_flashcard_answer(question: str, subject: str, context: str = "") -> str:
    """Generate a concise flashcard answer, grounded by context when available."""
    safe_subject = (subject or "General").strip() or "General"

    system = (
        "You are StudyBuddy Flashcard AI. Write a concise, exam-ready answer for a study flashcard.\n"
        "Rules:\n"
        "1. Keep answer short: 2-5 sentences, or brief bullet points when helpful.\n"
        "2. Use simple, student-friendly language.\n"
        "3. If context is provided, prioritize it.\n"
        "4. If context is missing, rely on accurate general knowledge for the subject.\n"
        "5. Do not include markdown headings or disclaimers.\n"
    )

    user_msg = (
        f"Subject: {safe_subject}\n"
        f"Question: {question.strip()}\n\n"
        f"Context:\n{context.strip() if context.strip() else '[No uploaded context found]'}"
    )

    messages = [("system", system), ("human", user_msg)]
    response = llm.invoke(messages)
    return response.content
