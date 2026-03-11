"""LLM service - Groq Chat for notes, Q&A, greetings"""
import json
from langchain_groq import ChatGroq

from config import GROQ_API_KEY

# LangChain Groq client used for both study chat and structured extraction flows.
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
)


def extract_info_llm(text: str) -> dict:
    """Extract schedule event info from text using LLM."""
    from datetime import datetime, timedelta
    now = datetime.now()
    current_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    default_end_time = (now + timedelta(hours=1)).strftime("%H:%M")

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
        content = response.content.strip()
        # strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:].strip()
            content = content.strip()
        return json.loads(content)
    except Exception as e:
        print(f"Error extracting info: {e}")
        return {
            "title": "New Event",
            "subject": "General",
            "date": current_date,
            "start_time": current_time,
            "end_time": default_end_time,
            "priority": "normal"
        }


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
