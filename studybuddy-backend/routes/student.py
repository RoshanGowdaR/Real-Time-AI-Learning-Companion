"""Student routes"""
from fastapi import APIRouter, HTTPException

from models.schemas import StudentLoginRequest, StudentRequest, FeedbackRequest
from services import supabase_service

router = APIRouter()


@router.post("/student/register")
async def register_student(body: StudentRequest):
    """Register a new student."""
    try:
        # Check if student already exists for Google login convenience
        try:
            existing = supabase_service.get_student_by_email(body.email)
            return {
                "student_id": existing["id"],
                "name": existing["name"],
                "email": existing.get("email"),
                "status": "success",
            }
        except Exception as lookup_error:
            # Supabase single() raises when email is not found; allow create flow only for that case.
            lookup_message = str(lookup_error).lower()
            not_found = (
                "0 rows" in lookup_message
                or "no rows" in lookup_message
                or "json object requested" in lookup_message
                or "pgrst116" in lookup_message
            )
            if not not_found:
                raise

        row = supabase_service.create_student(
            name=body.name,
            email=body.email,
        )
        return {
            "student_id": row["id"],
            "name": row["name"],
            "email": row["email"],
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
        if (
            "0 rows" in lower_message
            or "no rows" in lower_message
            or "json object requested" in lower_message
            or "pgrst116" in lower_message
            or "cannot coerce" in lower_message
        ):
            raise HTTPException(status_code=404, detail="No account found for this email.")
        raise HTTPException(status_code=500, detail=message)


@router.get("/student/{student_id}")
async def get_student(student_id: str):
    """Get student by ID."""
    try:
        row = supabase_service.get_student(student_id)
        if not row:
            raise HTTPException(status_code=404, detail="Student not found")
        return {
            "student_id": row["id"],
            "name": row.get("name", "Student"),
            "email": row.get("email", ""),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Student not found: {e}")


@router.post("/student/feedback")
@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest):
    """
    Process session feedback:
    1. Records row into models/feedback.xlsx
    2. Runs Find-S algorithm and updates models/hypothesis.json
    3. Adapts Version Space profile in database
    """
    try:
        from services.ml_models_service import append_feedback_to_excel

        excel_result = append_feedback_to_excel(
            rating=body.rating,
            feedback_text=body.feedback or "",
            intent=body.intent or "on-track",
            emotion=body.emotion or "neutral",
            response_depth=body.response_depth or body.intent or "on-track",
            used_examples="True",
        )

        vs_result = None
        if body.student_id:
            try:
                from services.version_space_service import update_hypothesis_from_feedback
                vs_result = update_hypothesis_from_feedback(
                    student_id=body.student_id,
                    rating=body.rating,
                    feedback_text=body.feedback or "",
                )
            except Exception as vs_err:
                pass

        active_inst = (
            (vs_result.get("active_instruction") if vs_result else None)
            or f"Find-S Hypothesis: examples={excel_result.get('hypothesis', {}).get('used_examples', 'True')}, intent={excel_result.get('hypothesis', {}).get('intent', '?')}, depth={excel_result.get('hypothesis', {}).get('response_depth', '?')}"
        )

        return {
            "status": "success",
            "message": "Feedback successfully saved to feedback.xlsx and hypothesis updated via Find-S!",
            "excel": excel_result,
            "hypothesis": excel_result.get("hypothesis"),
            "version_space": vs_result,
            "active_instruction": active_inst,
            "result": {
                "active_instruction": active_inst,
                "hypothesis": excel_result.get("hypothesis"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}/hypothesis")
@router.get("/hypothesis")
async def get_hypothesis(student_id: str | None = None):
    """Fetch current Find-S hypothesis profile and instruction."""
    try:
        from services.ml_models_service import load_find_s_hypothesis
        h = load_find_s_hypothesis()

        instruction = "Standard interactive explanation."
        if student_id:
            try:
                from services.version_space_service import get_hypothesis_prompt_instruction
                instruction = get_hypothesis_prompt_instruction(student_id)
            except Exception:
                pass

        return {
            "status": "success",
            "hypothesis": h,
            "instruction": instruction,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


