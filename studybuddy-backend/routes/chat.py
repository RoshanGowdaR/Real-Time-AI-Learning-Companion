"""Chat routes"""
from fastapi import APIRouter, HTTPException

from models.schemas import ChatRequest
from services.llm_service import answer_question
from services.rag_service import query_rag

router = APIRouter()


@router.post("/chat")
async def chat(body: ChatRequest):
    """Answer question using RAG context and LLM."""
    try:
        context = query_rag(body.question, body.student_id)
        answer = answer_question(body.question, context)
        return {"answer": answer, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
