"""Exam system routes — CRUD, questions, submissions, grading, leaderboard."""
import json
import re
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_service import supabase
from services.llm_service import llm

router = APIRouter()

# ─── Request models ───────────────────────────────────────


class CreateExamRequest(BaseModel):
    subject_id: str
    teacher_id: str
    title: str
    description: Optional[str] = ""
    exam_type: str  # mcq or written
    duration_mins: Optional[int] = 60
    total_marks: Optional[int] = 100
    closes_at: Optional[str] = None


class ExamStatusRequest(BaseModel):
    status: str  # active or closed


class MCQQuestionRequest(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str  # A, B, C, D
    marks: Optional[int] = 1


class BulkMCQRequest(BaseModel):
    questions: List[MCQQuestionRequest]


class WrittenQuestionRequest(BaseModel):
    question_text: str
    max_marks: Optional[int] = 10


class GenerateMCQRequest(BaseModel):
    topic: str
    count: Optional[int] = 5
    difficulty: Optional[str] = "Medium"


class MCQAnswerItem(BaseModel):
    question_id: str
    selected_option: str


class SubmitMCQRequest(BaseModel):
    exam_id: str
    student_id: str
    answers: List[MCQAnswerItem]


class WrittenAnswerItem(BaseModel):
    question_id: str
    answer_text: str


class SubmitWrittenRequest(BaseModel):
    exam_id: str
    student_id: str
    answers: List[WrittenAnswerItem]


class GradeAnswerItem(BaseModel):
    answer_id: str
    marks_awarded: float
    teacher_feedback: Optional[str] = ""


class GradeSubmissionRequest(BaseModel):
    answers: List[GradeAnswerItem]
    teacher_remarks: Optional[str] = ""


# ─── Helpers ──────────────────────────────────────────────


def _recalculate_ranks(exam_id: str):
    """Recalculate rank column for all leaderboard entries of an exam."""
    rows = (
        supabase.table("leaderboard")
        .select("id, total_score")
        .eq("exam_id", exam_id)
        .order("total_score", desc=True)
        .execute()
        .data
        or []
    )
    for idx, row in enumerate(rows):
        supabase.table("leaderboard").update({"rank": idx + 1}).eq("id", row["id"]).execute()


def _upsert_leaderboard(exam_id: str, subject_id: str, student_id: str, student_name: str, total_score: float):
    """Insert or update a leaderboard entry for a student+exam pair."""
    existing = (
        supabase.table("leaderboard")
        .select("id")
        .eq("exam_id", exam_id)
        .eq("student_id", student_id)
        .execute()
        .data
        or []
    )
    if existing:
        supabase.table("leaderboard").update({
            "total_score": total_score,
            "student_name": student_name,
            "updated_at": "now()",
        }).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("leaderboard").insert({
            "exam_id": exam_id,
            "subject_id": subject_id,
            "student_id": student_id,
            "student_name": student_name,
            "total_score": total_score,
        }).execute()


def _require_uuid(value: str, field_name: str) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid {field_name} format. Expected UUID.")


# ─── Exam CRUD ────────────────────────────────────────────


@router.post("/exam/create")
async def create_exam(req: CreateExamRequest):
    if req.exam_type not in ("mcq", "written"):
        raise HTTPException(400, "exam_type must be 'mcq' or 'written'")

    subject_id = _require_uuid(req.subject_id, "subject_id")

    payload = {
        "subject_id": subject_id,
        "teacher_id": req.teacher_id,
        "title": req.title,
        "description": req.description or "",
        "exam_type": req.exam_type,
        "duration_mins": req.duration_mins,
        "total_marks": req.total_marks,
        "status": "draft",
    }
    if req.closes_at:
        payload["closes_at"] = req.closes_at

    result = supabase.table("exams").insert(payload).execute()
    row = result.data[0] if result.data else {}
    return {"exam_id": row.get("id"), "title": row.get("title"), "exam_type": row.get("exam_type"), "status": row.get("status")}


@router.get("/exam/subject/{subject_id}")
async def get_subject_exams(subject_id: str):
    """Student-facing: returns only active exams with question counts."""
    subject_id = _require_uuid(subject_id, "subject_id")

    exams = (
        supabase.table("exams")
        .select("*")
        .eq("subject_id", subject_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    result = []
    for exam in exams:
        if exam.get("exam_type") == "mcq":
            qs = supabase.table("mcq_questions").select("id", count="exact").eq("exam_id", exam["id"]).execute()
        else:
            qs = supabase.table("written_questions").select("id", count="exact").eq("exam_id", exam["id"]).execute()
        q_count = qs.count if qs.count is not None else len(qs.data or [])
        result.append({
            "id": exam["id"],
            "title": exam["title"],
            "exam_type": exam["exam_type"],
            "status": exam["status"],
            "duration_mins": exam["duration_mins"],
            "total_marks": exam["total_marks"],
            "closes_at": exam.get("closes_at"),
            "question_count": q_count,
        })
    return {"exams": result}


@router.get("/exam/subject/{subject_id}/all")
async def get_all_subject_exams(subject_id: str):
    """Teacher-facing: returns all exams regardless of status with submission + question counts."""
    subject_id = _require_uuid(subject_id, "subject_id")

    exams = (
        supabase.table("exams")
        .select("*")
        .eq("subject_id", subject_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    for exam in exams:
        subs = (
            supabase.table("exam_submissions")
            .select("id", count="exact")
            .eq("exam_id", exam["id"])
            .execute()
        )
        exam["submission_count"] = subs.count if subs.count is not None else len(subs.data or [])
        if exam.get("exam_type") == "mcq":
            qs = supabase.table("mcq_questions").select("id", count="exact").eq("exam_id", exam["id"]).execute()
        else:
            qs = supabase.table("written_questions").select("id", count="exact").eq("exam_id", exam["id"]).execute()
        exam["question_count"] = qs.count if qs.count is not None else len(qs.data or [])
    return {"exams": exams}


@router.get("/exam/{exam_id}")
async def get_exam_details(exam_id: str):
    result = supabase.table("exams").select("*").eq("id", exam_id).execute()
    if not result.data:
        raise HTTPException(404, "Exam not found")

    exam = result.data[0]
    if exam.get("exam_type") == "mcq":
        questions = (
            supabase.table("mcq_questions")
            .select("*")
            .eq("exam_id", exam_id)
            .order("created_at")
            .execute()
            .data
            or []
        )
        exam["questions"] = questions
    else:
        questions = (
            supabase.table("written_questions")
            .select("*")
            .eq("exam_id", exam_id)
            .order("created_at")
            .execute()
            .data
            or []
        )
        exam["questions"] = questions

    return exam


@router.patch("/exam/{exam_id}/status")
async def update_exam_status(exam_id: str, req: ExamStatusRequest):
    if req.status not in ("active", "closed"):
        raise HTTPException(400, "status must be 'active' or 'closed'")

    if req.status == "active":
        exam_row = supabase.table("exams").select("exam_type").eq("id", exam_id).execute()
        if not exam_row.data:
            raise HTTPException(404, "Exam not found")
        exam_type = exam_row.data[0].get("exam_type", "mcq")
        table = "mcq_questions" if exam_type == "mcq" else "written_questions"
        qs = supabase.table(table).select("id", count="exact").eq("exam_id", exam_id).execute()
        q_count = qs.count if qs.count is not None else len(qs.data or [])
        if q_count == 0:
            raise HTTPException(400, "Add at least 1 question before activating exam")

    supabase.table("exams").update({"status": req.status}).eq("id", exam_id).execute()

    if req.status == "closed":
        _recalculate_ranks(exam_id)

    return {"exam_id": exam_id, "status": req.status, "updated": True}


@router.delete("/exam/{exam_id}")
async def delete_exam(exam_id: str):
    # Cascade: delete leaderboard, answers, submissions, questions, then exam
    supabase.table("leaderboard").delete().eq("exam_id", exam_id).execute()

    subs = supabase.table("exam_submissions").select("id").eq("exam_id", exam_id).execute().data or []
    for sub in subs:
        supabase.table("mcq_answers").delete().eq("submission_id", sub["id"]).execute()
        supabase.table("written_answers").delete().eq("submission_id", sub["id"]).execute()
    supabase.table("exam_submissions").delete().eq("exam_id", exam_id).execute()

    supabase.table("mcq_questions").delete().eq("exam_id", exam_id).execute()
    supabase.table("written_questions").delete().eq("exam_id", exam_id).execute()
    supabase.table("exams").delete().eq("id", exam_id).execute()

    return {"deleted": True}


# ─── MCQ Questions ────────────────────────────────────────


@router.post("/exam/{exam_id}/mcq/question")
async def add_mcq_question(exam_id: str, req: MCQQuestionRequest):
    if req.correct_option not in ("A", "B", "C", "D"):
        raise HTTPException(400, "correct_option must be A, B, C, or D")

    result = supabase.table("mcq_questions").insert({
        "exam_id": exam_id,
        "question_text": req.question_text,
        "option_a": req.option_a,
        "option_b": req.option_b,
        "option_c": req.option_c,
        "option_d": req.option_d,
        "correct_option": req.correct_option,
        "marks": req.marks,
    }).execute()

    row = result.data[0] if result.data else {}
    return {"question_id": row.get("id"), "status": "added"}


@router.post("/exam/{exam_id}/mcq/questions/bulk")
async def add_mcq_questions_bulk(exam_id: str, req: BulkMCQRequest):
    rows = []
    for q in req.questions:
        rows.append({
            "exam_id": exam_id,
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_option": q.correct_option,
            "marks": q.marks,
        })

    if rows:
        supabase.table("mcq_questions").insert(rows).execute()

    return {"added": len(rows)}


@router.delete("/exam/mcq/question/{question_id}")
async def delete_mcq_question(question_id: str):
    supabase.table("mcq_questions").delete().eq("id", question_id).execute()
    return {"deleted": True}


# ─── Written Questions ────────────────────────────────────


@router.post("/exam/{exam_id}/written/question")
async def add_written_question(exam_id: str, req: WrittenQuestionRequest):
    result = supabase.table("written_questions").insert({
        "exam_id": exam_id,
        "question_text": req.question_text,
        "max_marks": req.max_marks,
    }).execute()

    row = result.data[0] if result.data else {}
    return {"question_id": row.get("id"), "status": "added"}


@router.delete("/exam/written/question/{question_id}")
async def delete_written_question(question_id: str):
    supabase.table("written_questions").delete().eq("id", question_id).execute()
    return {"deleted": True}


# ─── AI MCQ Generation ────────────────────────────────────


@router.post("/exam/{exam_id}/mcq/generate")
async def generate_mcq_with_ai(exam_id: str, req: GenerateMCQRequest):
    prompt = (
        f"Generate {req.count} MCQ questions about {req.topic} "
        f"at {req.difficulty} difficulty level.\n"
        "Return ONLY valid JSON array:\n"
        "[\n"
        "  {\n"
        '    "question_text": "string",\n'
        '    "option_a": "string",\n'
        '    "option_b": "string",\n'
        '    "option_c": "string",\n'
        '    "option_d": "string",\n'
        '    "correct_option": "A"|"B"|"C"|"D",\n'
        '    "marks": 1\n'
        "  }\n"
        "]\n"
        "No explanation, no markdown, pure JSON only."
    )

    messages = [("system", "You are an exam question generator. Output only valid JSON."), ("human", prompt)]
    response = llm.invoke(messages)
    raw = response.content.strip()

    # Extract JSON array from response (handle markdown code blocks)
    json_match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not json_match:
        raise HTTPException(500, "AI did not return valid JSON. Try again.")

    try:
        questions = json.loads(json_match.group())
    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned malformed JSON. Try again.")

    # Validate and insert
    rows = []
    for q in questions:
        correct = str(q.get("correct_option", "A")).upper()
        if correct not in ("A", "B", "C", "D"):
            correct = "A"
        rows.append({
            "exam_id": exam_id,
            "question_text": str(q.get("question_text", "")),
            "option_a": str(q.get("option_a", "")),
            "option_b": str(q.get("option_b", "")),
            "option_c": str(q.get("option_c", "")),
            "option_d": str(q.get("option_d", "")),
            "correct_option": correct,
            "marks": int(q.get("marks", 1)),
        })

    if rows:
        inserted = supabase.table("mcq_questions").insert(rows).execute()
        inserted_questions = inserted.data or []
    else:
        inserted_questions = []

    return {"generated": len(rows), "questions": inserted_questions}


# ─── Student Exam Endpoints ──────────────────────────────


@router.get("/exam/student/{student_id}/available")
async def get_available_exams(student_id: str):
    # Get approved subject enrollments
    enrollments = (
        supabase.table("subject_enrollments")
        .select("subject_id")
        .eq("student_id", student_id)
        .eq("status", "approved")
        .execute()
        .data
        or []
    )
    subject_ids = [e["subject_id"] for e in enrollments]
    if not subject_ids:
        return {"available": [], "submitted": []}

    # Get active exams for those subjects
    all_exams = []
    for sid in subject_ids:
        exams = (
            supabase.table("exams")
            .select("*")
            .eq("subject_id", sid)
            .eq("status", "active")
            .execute()
            .data
            or []
        )
        all_exams.extend(exams)

    # Get student submissions
    submissions = (
        supabase.table("exam_submissions")
        .select("exam_id")
        .eq("student_id", student_id)
        .execute()
        .data
        or []
    )
    submitted_exam_ids = {s["exam_id"] for s in submissions}

    available = [e for e in all_exams if e["id"] not in submitted_exam_ids]
    submitted = [e for e in all_exams if e["id"] in submitted_exam_ids]

    return {"available": available, "submitted": submitted}


@router.post("/exam/submit/mcq")
async def submit_mcq_exam(req: SubmitMCQRequest):
    # Check exam exists
    exam_result = supabase.table("exams").select("*").eq("id", req.exam_id).execute()
    if not exam_result.data:
        raise HTTPException(404, "Exam not found")
    exam = exam_result.data[0]

    # Check for duplicate submission
    existing = (
        supabase.table("exam_submissions")
        .select("id")
        .eq("exam_id", req.exam_id)
        .eq("student_id", req.student_id)
        .execute()
        .data
        or []
    )
    if existing:
        raise HTTPException(400, "You have already submitted this exam")

    # Get student name
    student_row = supabase.table("students").select("name").eq("id", req.student_id).execute().data
    student_name = student_row[0]["name"] if student_row else "Student"

    # Create submission
    sub = supabase.table("exam_submissions").insert({
        "exam_id": req.exam_id,
        "student_id": req.student_id,
        "status": "submitted",
        "total_score": 0,
    }).execute()
    submission_id = sub.data[0]["id"]

    # Fetch all questions to check answers
    questions_map = {}
    mcq_qs = (
        supabase.table("mcq_questions")
        .select("id, correct_option, marks")
        .eq("exam_id", req.exam_id)
        .execute()
        .data
        or []
    )
    for q in mcq_qs:
        questions_map[q["id"]] = q

    total_score = 0
    correct_count = 0
    wrong_count = 0

    answer_rows = []
    for ans in req.answers:
        q_data = questions_map.get(ans.question_id)
        if not q_data:
            continue
        is_correct = ans.selected_option.upper() == q_data["correct_option"].upper()
        marks = q_data.get("marks", 1) if is_correct else 0
        if is_correct:
            correct_count += 1
            total_score += marks
        else:
            wrong_count += 1

        answer_rows.append({
            "submission_id": submission_id,
            "question_id": ans.question_id,
            "selected_option": ans.selected_option.upper(),
            "is_correct": is_correct,
            "marks_awarded": marks,
        })

    if answer_rows:
        supabase.table("mcq_answers").insert(answer_rows).execute()

    # Update submission
    supabase.table("exam_submissions").update({
        "total_score": total_score,
        "status": "graded",
    }).eq("id", submission_id).execute()

    # Upsert leaderboard
    _upsert_leaderboard(req.exam_id, exam.get("subject_id", ""), req.student_id, student_name, total_score)
    _recalculate_ranks(req.exam_id)

    # Get rank
    rank_row = (
        supabase.table("leaderboard")
        .select("rank")
        .eq("exam_id", req.exam_id)
        .eq("student_id", req.student_id)
        .execute()
        .data
        or []
    )
    rank = rank_row[0]["rank"] if rank_row else None

    total_questions = len(questions_map)
    percentage = round((total_score / exam.get("total_marks", 100)) * 100, 1) if exam.get("total_marks") else 0

    return {
        "submission_id": submission_id,
        "total_score": total_score,
        "correct": correct_count,
        "wrong": wrong_count,
        "total_questions": total_questions,
        "percentage": percentage,
        "rank": rank,
    }


@router.post("/exam/submit/written")
async def submit_written_exam(req: SubmitWrittenRequest):
    exam_result = supabase.table("exams").select("*").eq("id", req.exam_id).execute()
    if not exam_result.data:
        raise HTTPException(404, "Exam not found")

    # Check for duplicate submission
    existing = (
        supabase.table("exam_submissions")
        .select("id")
        .eq("exam_id", req.exam_id)
        .eq("student_id", req.student_id)
        .execute()
        .data
        or []
    )
    if existing:
        raise HTTPException(400, "You have already submitted this exam")

    # Create submission
    sub = supabase.table("exam_submissions").insert({
        "exam_id": req.exam_id,
        "student_id": req.student_id,
        "status": "submitted",
        "total_score": 0,
    }).execute()
    submission_id = sub.data[0]["id"]

    # Fetch questions for context
    written_qs = (
        supabase.table("written_questions")
        .select("id, question_text, max_marks")
        .eq("exam_id", req.exam_id)
        .execute()
        .data
        or []
    )
    questions_map = {q["id"]: q for q in written_qs}

    answer_rows = []
    for ans in req.answers:
        q_data = questions_map.get(ans.question_id, {})
        question_text = q_data.get("question_text", "")
        max_marks = q_data.get("max_marks", 10)

        # Get AI suggested score
        ai_score = 0
        try:
            ai_prompt = (
                f"Question: {question_text}\n"
                f"Student Answer: {ans.answer_text}\n"
                f"Max Marks: {max_marks}\n"
                f"Rate this answer from 0 to {max_marks}.\n"
                "Reply ONLY with a number."
            )
            ai_messages = [("system", "You are an exam grading assistant. Reply with only a number."), ("human", ai_prompt)]
            ai_response = llm.invoke(ai_messages)
            score_text = ai_response.content.strip()
            # Extract number from response
            num_match = re.search(r'[\d.]+', score_text)
            if num_match:
                ai_score = min(float(num_match.group()), max_marks)
        except Exception:
            ai_score = 0

        answer_rows.append({
            "submission_id": submission_id,
            "question_id": ans.question_id,
            "answer_text": ans.answer_text,
            "marks_awarded": 0,
            "ai_suggested_score": ai_score,
            "evaluated": False,
        })

    if answer_rows:
        supabase.table("written_answers").insert(answer_rows).execute()

    return {"submission_id": submission_id, "status": "submitted"}


# ─── Teacher Grading ──────────────────────────────────────


@router.get("/exam/{exam_id}/submissions")
async def get_exam_submissions(exam_id: str):
    subs = (
        supabase.table("exam_submissions")
        .select("*, students(name, email)")
        .eq("exam_id", exam_id)
        .order("submitted_at", desc=True)
        .execute()
        .data
        or []
    )

    result = []
    for sub in subs:
        student = sub.get("students") or {}
        if isinstance(student, list):
            student = student[0] if student else {}
        result.append({
            "submission_id": sub["id"],
            "student_name": student.get("name", "Student"),
            "student_email": student.get("email", ""),
            "submitted_at": sub.get("submitted_at"),
            "total_score": sub.get("total_score", 0),
            "status": sub.get("status", "submitted"),
        })

    return {"submissions": result}


@router.get("/exam/submission/{submission_id}")
async def get_submission_detail(submission_id: str):
    sub = supabase.table("exam_submissions").select("*, students(name, email)").eq("id", submission_id).execute()
    if not sub.data:
        raise HTTPException(404, "Submission not found")

    submission = sub.data[0]
    student = submission.get("students") or {}
    if isinstance(student, list):
        student = student[0] if student else {}

    exam_id = submission["exam_id"]
    exam = supabase.table("exams").select("exam_type, title, total_marks").eq("id", exam_id).execute().data
    exam_type = exam[0]["exam_type"] if exam else "mcq"

    answers = []
    if exam_type == "mcq":
        rows = (
            supabase.table("mcq_answers")
            .select("*, mcq_questions(question_text, option_a, option_b, option_c, option_d, correct_option, marks)")
            .eq("submission_id", submission_id)
            .execute()
            .data
            or []
        )
        for row in rows:
            q = row.get("mcq_questions") or {}
            if isinstance(q, list):
                q = q[0] if q else {}
            answers.append({
                "answer_id": row["id"],
                "question_id": row.get("question_id"),
                "question_text": q.get("question_text", ""),
                "option_a": q.get("option_a", ""),
                "option_b": q.get("option_b", ""),
                "option_c": q.get("option_c", ""),
                "option_d": q.get("option_d", ""),
                "correct_option": q.get("correct_option", ""),
                "selected_option": row.get("selected_option", ""),
                "is_correct": row.get("is_correct", False),
                "marks_awarded": row.get("marks_awarded", 0),
                "max_marks": q.get("marks", 1),
            })
    else:
        rows = (
            supabase.table("written_answers")
            .select("*, written_questions(question_text, max_marks)")
            .eq("submission_id", submission_id)
            .execute()
            .data
            or []
        )
        for row in rows:
            q = row.get("written_questions") or {}
            if isinstance(q, list):
                q = q[0] if q else {}
            answers.append({
                "answer_id": row["id"],
                "question_id": row.get("question_id"),
                "question_text": q.get("question_text", ""),
                "answer_text": row.get("answer_text", ""),
                "marks_awarded": row.get("marks_awarded", 0),
                "max_marks": q.get("max_marks", 10),
                "ai_suggested_score": row.get("ai_suggested_score", 0),
                "teacher_feedback": row.get("teacher_feedback", ""),
                "evaluated": row.get("evaluated", False),
            })

    return {
        "submission_id": submission["id"],
        "exam_id": exam_id,
        "exam_type": exam_type,
        "exam_title": exam[0]["title"] if exam else "",
        "total_marks": exam[0].get("total_marks", 100) if exam else 100,
        "student_name": student.get("name", "Student"),
        "student_email": student.get("email", ""),
        "submitted_at": submission.get("submitted_at"),
        "total_score": submission.get("total_score", 0),
        "status": submission.get("status", "submitted"),
        "teacher_remarks": submission.get("teacher_remarks", ""),
        "answers": answers,
    }


@router.patch("/exam/submission/{submission_id}/grade")
async def grade_submission(submission_id: str, req: GradeSubmissionRequest):
    sub = supabase.table("exam_submissions").select("*, students(name)").eq("id", submission_id).execute()
    if not sub.data:
        raise HTTPException(404, "Submission not found")

    submission = sub.data[0]
    exam_id = submission["exam_id"]
    student_id = submission["student_id"]
    student = submission.get("students") or {}
    if isinstance(student, list):
        student = student[0] if student else {}
    student_name = student.get("name", "Student")

    # Update each answer
    for ans in req.answers:
        supabase.table("written_answers").update({
            "marks_awarded": ans.marks_awarded,
            "teacher_feedback": ans.teacher_feedback or "",
            "evaluated": True,
        }).eq("id", ans.answer_id).execute()

    # Calculate total score
    all_answers = (
        supabase.table("written_answers")
        .select("marks_awarded")
        .eq("submission_id", submission_id)
        .execute()
        .data
        or []
    )
    total_score = sum(a.get("marks_awarded", 0) for a in all_answers)

    # Update submission
    supabase.table("exam_submissions").update({
        "total_score": total_score,
        "status": "graded",
        "teacher_remarks": req.teacher_remarks or "",
    }).eq("id", submission_id).execute()

    # Get exam for subject_id
    exam_row = supabase.table("exams").select("subject_id").eq("id", exam_id).execute().data
    subject_id = exam_row[0]["subject_id"] if exam_row else ""

    _upsert_leaderboard(exam_id, subject_id, student_id, student_name, total_score)
    _recalculate_ranks(exam_id)

    return {
        "submission_id": submission_id,
        "total_score": total_score,
        "status": "graded",
        "leaderboard_updated": True,
    }


# ─── Leaderboard ─────────────────────────────────────────


@router.get("/leaderboard/exam/{exam_id}")
async def get_exam_leaderboard(exam_id: str):
    rows = (
        supabase.table("leaderboard")
        .select("*")
        .eq("exam_id", exam_id)
        .order("rank")
        .execute()
        .data
        or []
    )

    exam = supabase.table("exams").select("title, total_marks").eq("id", exam_id).execute().data
    exam_title = exam[0]["title"] if exam else ""
    total_marks = exam[0].get("total_marks", 100) if exam else 100

    result = []
    for row in rows:
        result.append({
            "rank": row.get("rank"),
            "student_name": row.get("student_name", "Student"),
            "total_score": row.get("total_score", 0),
            "exam_title": exam_title,
            "total_marks": total_marks,
        })

    return {"leaderboard": result, "exam_title": exam_title, "total_marks": total_marks}


@router.get("/leaderboard/subject/{subject_id}")
async def get_subject_leaderboard(subject_id: str):
    subject_id = _require_uuid(subject_id, "subject_id")

    # Get all exams for subject
    exams = (
        supabase.table("exams")
        .select("id")
        .eq("subject_id", subject_id)
        .execute()
        .data
        or []
    )
    exam_ids = [e["id"] for e in exams]
    if not exam_ids:
        return {"leaderboard": []}

    # Get all graded submissions for these exams
    all_subs = []
    for eid in exam_ids:
        subs = (
            supabase.table("exam_submissions")
            .select("student_id, total_score, students(name)")
            .eq("exam_id", eid)
            .eq("status", "graded")
            .execute()
            .data
            or []
        )
        all_subs.extend(subs)

    # Group by student
    student_scores = {}
    for sub in all_subs:
        sid = sub["student_id"]
        student = sub.get("students") or {}
        if isinstance(student, list):
            student = student[0] if student else {}
        name = student.get("name", "Student")
        if sid not in student_scores:
            student_scores[sid] = {"student_name": name, "total_score": 0, "exams_attempted": 0}
        student_scores[sid]["total_score"] += sub.get("total_score", 0)
        student_scores[sid]["exams_attempted"] += 1

    # Rank
    ranked = sorted(student_scores.values(), key=lambda x: x["total_score"], reverse=True)
    for idx, entry in enumerate(ranked):
        entry["rank"] = idx + 1

    return {"leaderboard": ranked}


@router.get("/exam/student/{student_id}/result/{exam_id}")
async def get_student_result(student_id: str, exam_id: str):
    sub = (
        supabase.table("exam_submissions")
        .select("*")
        .eq("exam_id", exam_id)
        .eq("student_id", student_id)
        .execute()
        .data
        or []
    )
    if not sub:
        raise HTTPException(404, "No submission found for this exam")

    submission = sub[0]

    # Get exam details
    exam = supabase.table("exams").select("*").eq("id", exam_id).execute().data
    exam_data = exam[0] if exam else {}

    # Get rank
    rank_row = (
        supabase.table("leaderboard")
        .select("rank")
        .eq("exam_id", exam_id)
        .eq("student_id", student_id)
        .execute()
        .data
        or []
    )
    rank = rank_row[0]["rank"] if rank_row else None

    # Get answers
    answers = []
    if exam_data.get("exam_type") == "mcq":
        rows = (
            supabase.table("mcq_answers")
            .select("*, mcq_questions(question_text, option_a, option_b, option_c, option_d, correct_option, marks)")
            .eq("submission_id", submission["id"])
            .execute()
            .data
            or []
        )
        for row in rows:
            q = row.get("mcq_questions") or {}
            if isinstance(q, list):
                q = q[0] if q else {}
            answers.append({
                "question_text": q.get("question_text", ""),
                "selected_option": row.get("selected_option"),
                "correct_option": q.get("correct_option"),
                "is_correct": row.get("is_correct"),
                "marks_awarded": row.get("marks_awarded", 0),
            })
    else:
        rows = (
            supabase.table("written_answers")
            .select("*, written_questions(question_text, max_marks)")
            .eq("submission_id", submission["id"])
            .execute()
            .data
            or []
        )
        for row in rows:
            q = row.get("written_questions") or {}
            if isinstance(q, list):
                q = q[0] if q else {}
            answers.append({
                "question_text": q.get("question_text", ""),
                "answer_text": row.get("answer_text", ""),
                "marks_awarded": row.get("marks_awarded", 0),
                "max_marks": q.get("max_marks", 10),
                "teacher_feedback": row.get("teacher_feedback", ""),
                "evaluated": row.get("evaluated", False),
            })

    return {
        "submission_id": submission["id"],
        "exam_id": exam_id,
        "exam_title": exam_data.get("title", ""),
        "exam_type": exam_data.get("exam_type", ""),
        "total_marks": exam_data.get("total_marks", 100),
        "total_score": submission.get("total_score", 0),
        "status": submission.get("status"),
        "rank": rank,
        "teacher_remarks": submission.get("teacher_remarks", ""),
        "answers": answers,
    }
