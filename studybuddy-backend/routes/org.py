from typing import Optional
import hashlib
import random
import string

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import supabase_service as db

router = APIRouter()


def make_invite_code():
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=8))


def make_subject_code(subject_name: str):
    prefix = subject_name[:4].upper().replace(" ", "")
    nums = "".join(random.choices(string.digits, k=4))
    return f"{prefix}-{nums}"


def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()


class CreateOrgRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class RegisterTeacherRequest(BaseModel):
    org_id: str
    email: str
    full_name: str
    password: str
    subject_name: str


class TeacherLoginRequest(BaseModel):
    email: str
    password: str


class JoinOrgRequest(BaseModel):
    invite_code: str
    student_id: str


class MemberStatusRequest(BaseModel):
    status: str  # approved or rejected


@router.post("/org/create")
async def create_org(req: CreateOrgRequest):
    try:
        invite_code = make_invite_code()
        org = await db.create_org(req.name, req.description or "", invite_code)
        return {
            "org_id": org["id"],
            "name": org["name"],
            "invite_code": org["invite_code"],
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/register-teacher")
async def register_teacher(req: RegisterTeacherRequest):
    try:
        existing = await db.get_teacher_by_email(req.email)
        if existing:
            raise HTTPException(status_code=409, detail="This email is already registered as a teacher")

        pwd_hash = hash_password(req.password)
        teacher = await db.create_teacher(req.email, pwd_hash, req.full_name, req.org_id)

        subject_code = make_subject_code(req.subject_name)
        subject = await db.create_subject(req.org_id, teacher["id"], req.subject_name, subject_code)

        return {
            "teacher_id": teacher["id"],
            "email": teacher["email"],
            "full_name": teacher["full_name"],
            "subject_id": subject["id"],
            "subject_name": subject["name"],
            "subject_code": subject["subject_code"],
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/teacher/login")
async def teacher_login(req: TeacherLoginRequest):
    try:
        teacher = await db.get_teacher_by_email(req.email)
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        if not teacher.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account is inactive")

        pwd_hash = hash_password(req.password)
        if pwd_hash != teacher.get("password_hash"):
            raise HTTPException(status_code=401, detail="Invalid password")

        subjects = await db.get_subjects_by_teacher(teacher["id"])
        subject = subjects[0] if subjects else None

        return {
            "teacher_id": teacher["id"],
            "full_name": teacher["full_name"],
            "email": teacher["email"],
            "org_id": teacher.get("org_id"),
            "subject": subject,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/join")
async def join_org(req: JoinOrgRequest):
    try:
        org = await db.get_org_by_invite_code(req.invite_code)
        if not org:
            raise HTTPException(status_code=404, detail="Invalid invite code")

        member = await db.create_org_member(org["id"], req.student_id)
        if not member:
            raise HTTPException(status_code=409, detail="You already requested to join this org")

        return {
            "org_id": org["id"],
            "org_name": org["name"],
            "status": "pending",
            "message": "Request sent! Waiting for approval.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/{org_id}/pending")
async def get_pending(org_id: str):
    try:
        members = await db.get_pending_members(org_id)
        return {"members": members, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/org/member/{member_id}")
async def update_member(member_id: str, req: MemberStatusRequest):
    try:
        if req.status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Invalid status")

        updated = await db.update_member_status(member_id, req.status)

        if req.status == "approved" and updated:
            await db.enroll_student_in_subjects(updated["student_id"], updated["org_id"])

        return {
            "member_id": member_id,
            "status": req.status,
            "updated": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/student/{student_id}")
async def get_student_orgs(student_id: str):
    try:
        orgs = await db.get_student_orgs(student_id)
        return {"orgs": orgs, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/{org_id}/subjects")
async def get_org_subjects(org_id: str):
    try:
        subjects = await db.get_subjects_by_org(org_id)
        return {"subjects": subjects, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/{org_id}")
async def get_org(org_id: str):
    try:
        org = await db.get_org_by_id(org_id)
        if not org:
            raise HTTPException(status_code=404, detail="Org not found")
        return {**org, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
