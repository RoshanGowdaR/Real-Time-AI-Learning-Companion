"""LLM service - Groq Chat for notes, Q&A, greetings"""
from langchain_groq import ChatGroq

from config import GROQ_API_KEY

llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama3-8b-8192",
)


def generate_notes(text: str) -> str:
    """Convert text into structured study notes."""
    system = (
        "You are StudyBuddy. Convert the text into structured study notes with "
        "headings, bullet points, key terms highlighted, and a short summary at the end."
    )
    messages = [("system", system), ("human", text)]
    response = llm.invoke(messages)
    return response.content


def answer_question(question: str, context: str) -> str:
    """Answer based on context only. Concise and student-friendly."""
    system = (
        "You are Sensei, a friendly study assistant. Answer based on the given "
        "context only. Be concise and student-friendly."
    )
    user_msg = f"Context:\n{context}\n\nQuestion: {question}"
    messages = [("system", system), ("human", user_msg)]
    response = llm.invoke(messages)
    return response.content


def generate_greeting(student_name: str, recent_sessions: list) -> str:
    """Generate personalized greeting mentioning recent sessions and a goal."""
    system = (
        "You are Sensei, a warm AI study companion."
    )
    user_msg = (
        f"Write a short personalized greeting for {student_name}. "
        f"Recent sessions: {recent_sessions}. Mention what they studied, "
        f"and give one motivating goal for today. Max 80 words."
    )
    messages = [("system", system), ("human", user_msg)]
    response = llm.invoke(messages)
    return response.content
