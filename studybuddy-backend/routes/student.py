"""Student routes"""
from fastapi import APIRouter, HTTPException

from models.schemas import StudentRequest
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
        raise HTTPException(status_code=500, detail=str(e))


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
