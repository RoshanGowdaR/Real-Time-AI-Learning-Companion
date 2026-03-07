"""Student routes"""
from fastapi import APIRouter, HTTPException

from models.schemas import StudentLoginRequest, StudentRequest
from services import supabase_service

router = APIRouter()


@router.post("/student/register")
async def register_student(body: StudentRequest):
    """Register a new student."""
    try:
        row = supabase_service.create_student(
            name=body.name,
            email=body.email,
        )
        return {
            "student_id": row["id"],
            "name": row["name"],
            "status": "success",
        }
    except Exception as e:
        message = str(e)
        if "duplicate" in message.lower() or "unique" in message.lower():
            raise HTTPException(status_code=409, detail="Email already registered. Please log in.")
        raise HTTPException(status_code=500, detail=message)


@router.post("/student/login")
async def login_student(body: StudentLoginRequest):
    """Log in an existing student by email."""
    try:
        row = supabase_service.get_student_by_email(body.email)
        return {
            "student_id": row["id"],
            "name": row["name"],
            "status": "success",
        }
    except Exception as e:
        message = str(e)
        lower_message = message.lower()
        if "0 rows" in lower_message or "no rows" in lower_message or "json object requested" in lower_message:
            raise HTTPException(status_code=404, detail="No account found for this email.")
        raise HTTPException(status_code=500, detail=message)


@router.get("/student/{student_id}")
async def get_student(student_id: str):
    """Get student by ID."""
    try:
        row = supabase_service.get_student(student_id)
        return {
            "student_id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
