"""LLM service - Groq Chat for notes, Q&A, greetings.

Includes a fast offline fallback when Groq is unavailable/misconfigured so local
development and automated tests don't hang on external calls.
"""

from __future__ import annotations

from textwrap import shorten

from config import GROQ_API_KEY

try:
    from langchain_groq import ChatGroq  # type: ignore
except Exception:  # pragma: no cover
    ChatGroq = None


def _get_llm():
    if not GROQ_API_KEY or not ChatGroq:
        return None
    # Keep this intentionally short so API endpoints return quickly even when the
    # key is invalid or the network is flaky.
    return ChatGroq(api_key=GROQ_API_KEY, model="llama3-8b-8192", timeout=8, max_retries=0)


def _fallback_notes(text: str) -> str:
    snippet = shorten(text.replace("\n", " "), width=600, placeholder="...")
    return "\n".join(
        [
            "Study Notes (offline fallback)",
            "",
            "- Key points:",
            f"  - {snippet}",
            "",
            "- Summary:",
            "  - Generated without an external LLM (GROQ unavailable).",
        ]
    )


def _fallback_answer(question: str, context: str) -> str:
    ctx = shorten((context or "").replace("\n", " "), width=500, placeholder="...")
    q = shorten(question.replace("\n", " "), width=200, placeholder="...")
    if ctx:
        return f"(offline fallback) Based on your document: {ctx}"
    return f"(offline fallback) I don't have document context yet. Question: {q}"


def _fallback_greeting(student_name: str) -> str:
    name = student_name or "there"
    return f"Hi {name}! (offline fallback) What topic would you like to study today?"


def generate_notes(text: str) -> str:
    """Convert text into structured study notes."""
    llm = _get_llm()
    if llm is None:
        return _fallback_notes(text)
    try:
        system = (
            "You are StudyBuddy. Convert the text into structured study notes with "
            "headings, bullet points, key terms highlighted, and a short summary at the end."
        )
        messages = [("system", system), ("human", text)]
        response = llm.invoke(messages)
        return response.content
    except Exception:
        return _fallback_notes(text)


def answer_question(question: str, context: str) -> str:
    """Answer based on context only. Concise and student-friendly."""
    llm = _get_llm()
    if llm is None:
        return _fallback_answer(question, context)
    try:
        system = (
            "You are Sensei, a friendly study assistant. Answer based on the given "
            "context only. Be concise and student-friendly."
        )
        user_msg = f"Context:\n{context}\n\nQuestion: {question}"
        messages = [("system", system), ("human", user_msg)]
        response = llm.invoke(messages)
        return response.content
    except Exception:
        return _fallback_answer(question, context)


def generate_greeting(student_name: str, recent_sessions: list) -> str:
    """Generate personalized greeting mentioning recent sessions and a goal."""
    llm = _get_llm()
    if llm is None:
        return _fallback_greeting(student_name)
    try:
        system = "You are Sensei, a warm AI study companion."
        user_msg = (
            f"Write a short personalized greeting for {student_name}. "
            f"Recent sessions: {recent_sessions}. Mention what they studied, "
            f"and give one motivating goal for today. Max 80 words."
        )
        messages = [("system", system), ("human", user_msg)]
        response = llm.invoke(messages)
        return response.content
    except Exception:
        return _fallback_greeting(student_name)
