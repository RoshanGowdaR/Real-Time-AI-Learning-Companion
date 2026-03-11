from typing import Optional
import hashlib
import random
import string

from fastapi import APIRouter, HTTPException, Query
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


class OrgAdminRegisterRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    email: str
    password: str


class OrgAdminLoginRequest(BaseModel):
    email: str
    password: str


class RegisterTeacherRequest(BaseModel):
    org_id: str
    email: str
    full_name: str
    password: str
    subject_name: str


class TeacherLoginRequest(BaseModel):
    email: str
    password: str


class CreateAnnouncementRequest(BaseModel):
    teacher_id: str
    subject_id: str
    title: str
    body: Optional[str] = ""
    tag: Optional[str] = "General"


class CreateAssignmentRequest(BaseModel):
    teacher_id: str
    subject_id: str
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    max_score: Optional[int] = 100


class JoinOrgRequest(BaseModel):
    invite_code: str
    student_id: str


class JoinSubjectRequest(BaseModel):
    subject_code: str
    student_id: str


class MemberStatusRequest(BaseModel):
    status: str  # approved or rejected


def relation_first(value):
    if isinstance(value, list):
        return value[0] if value else None
    if isinstance(value, dict):
        return value
    return None


def map_enrollment_row(row: dict):
    subject = relation_first(row.get("subjects")) or {}
    teacher = relation_first(subject.get("teachers")) or {}
    org = relation_first(subject.get("organizations")) or {}
    student = relation_first(row.get("students")) or {}

    return {
        "enrollment_id": row.get("id"),
        "status": row.get("status") or "pending",
        "requested_at": row.get("requested_at"),
        "reviewed_at": row.get("reviewed_at"),
        "enrolled_at": row.get("enrolled_at"),
        "student": {
            "id": student.get("id"),
            "name": student.get("name") or "Student",
            "email": student.get("email") or "",
        },
        "subject": {
            "id": subject.get("id"),
            "name": subject.get("name") or "Subject",
            "subject_code": subject.get("subject_code") or "",
        },
        "teacher": {
            "id": subject.get("teacher_id") or teacher.get("id"),
            "full_name": teacher.get("full_name") or "Unknown",
            "email": teacher.get("email") or "",
        },
        "organization": {
            "id": subject.get("org_id") or org.get("id"),
            "name": org.get("name") or "Organization",
        },
    }


async def ensure_teacher_can_manage_subject(teacher_id: str, subject_id: str):
    """Ensure teacher exists and is assigned to the subject they are mutating."""
    teacher = await db.get_teacher_by_id(teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    subject = await db.get_subject_by_id(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if str(subject.get("teacher_id") or "") != str(teacher_id):
        raise HTTPException(status_code=403, detail="Teacher is not assigned to this subject")

    return teacher, subject


async def generate_unique_invite_code():
    """Generate invite code that does not collide with existing organizations."""
    for _ in range(20):
        code = make_invite_code()
        existing = await db.get_org_by_invite_code(code)
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique invite code")


async def generate_unique_subject_code(subject_name: str):
    """Generate subject code that does not collide with existing subjects."""
    for _ in range(20):
        code = make_subject_code(subject_name)
        existing = await db.get_subject_by_code(code)
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique subject code")


@router.post("/org/create")
async def create_org(req: CreateOrgRequest):
    try:
        invite_code = await generate_unique_invite_code()
        org = await db.create_org(req.name, req.description or "", invite_code)
        return {
            "org_id": org["id"],
            "name": org["name"],
            "invite_code": org["invite_code"],
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/admin/register")
async def register_org_admin(req: OrgAdminRegisterRequest):
    try:
        email = req.email.strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        if not req.password:
            raise HTTPException(status_code=400, detail="Password is required")

        existing = await db.get_org_by_admin_email(email)
        if existing:
            raise HTTPException(status_code=409, detail="Organization admin already exists for this email")

        invite_code = await generate_unique_invite_code()
        org = await db.create_org_admin(
            name=req.name.strip(),
            description=(req.description or "").strip(),
            invite_code=invite_code,
            admin_email=email,
            password_hash=hash_password(req.password),
        )

        return {
            "org_id": org["id"],
            "name": org["name"],
            "invite_code": org["invite_code"],
            "email": org.get("admin_email"),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/admin/login")
async def login_org_admin(req: OrgAdminLoginRequest):
    try:
        email = req.email.strip().lower()
        org = await db.get_org_by_admin_email(email)
        if not org:
            raise HTTPException(status_code=404, detail="Organization admin not found")

        pwd_hash = hash_password(req.password)
        if pwd_hash != org.get("password_hash"):
            raise HTTPException(status_code=401, detail="Invalid password")

        return {
            "org_id": org["id"],
            "name": org["name"],
            "invite_code": org.get("invite_code"),
            "email": org.get("admin_email"),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/register-teacher")
async def register_teacher(req: RegisterTeacherRequest):
    try:
        normalized_email = req.email.strip().lower()
        if not normalized_email:
            raise HTTPException(status_code=400, detail="Teacher email is required")

        existing = await db.get_teacher_by_email(normalized_email)
        org = await db.get_org_by_id(req.org_id)
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        if existing and str(existing.get("org_id") or "") != str(req.org_id):
            raise HTTPException(status_code=409, detail="This email is already registered in another organization")

        if existing:
            teacher = existing
        else:
            pwd_hash = hash_password(req.password)
            teacher = await db.create_teacher(normalized_email, pwd_hash, req.full_name, req.org_id)

        subject_code = await generate_unique_subject_code(req.subject_name)
        subject = await db.create_subject(req.org_id, teacher["id"], req.subject_name, subject_code)

        return {
            "teacher_id": teacher["id"],
            "email": teacher["email"],
            "full_name": teacher["full_name"],
            "subject_id": subject["id"],
            "subject_name": subject["name"],
            "subject_code": subject["subject_code"],
            "teacher_already_exists": bool(existing),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/org/teacher/{teacher_id}")
async def delete_teacher(teacher_id: str, org_id: str = Query(...)):
    try:
        if not org_id:
            raise HTTPException(status_code=400, detail="org_id query parameter is required")

        deleted = await db.delete_teacher_and_subjects(org_id, teacher_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Teacher not found for this organization")

        return {
            "teacher_id": teacher_id,
            "org_id": org_id,
            "deleted_subjects": deleted.get("deleted_subjects", 0),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/org/teacher/login")
async def teacher_login(req: TeacherLoginRequest):
    try:
        email = (req.email or "").strip().lower()
        teacher = await db.get_teacher_by_email(email)
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

        if not teacher.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account is inactive")

        pwd_hash = hash_password(req.password)
        if pwd_hash != teacher.get("password_hash"):
            raise HTTPException(status_code=401, detail="Invalid password")

        subjects = await db.get_subjects_by_teacher(teacher["id"])
        active_subject = subjects[0] if subjects else None

        return {
            "teacher_id": teacher["id"],
            "full_name": teacher["full_name"],
            "email": teacher["email"],
            "org_id": teacher.get("org_id"),
            "subjects": subjects,
            "active_subject": active_subject,
            "subject": active_subject,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subject/join")
async def join_subject(req: JoinSubjectRequest):
    try:
        subject_code = (req.subject_code or "").strip().upper()
        if not subject_code:
            raise HTTPException(status_code=400, detail="Subject code is required")

        subject = await db.get_subject_by_code(subject_code)
        if not subject:
            raise HTTPException(status_code=404, detail="Invalid subject code")

        enrollment, action = await db.create_subject_enrollment_request(subject["id"], req.student_id)

        if action == "already_approved":
            raise HTTPException(status_code=409, detail="You are already enrolled in this subject")

        if action == "already_pending":
            raise HTTPException(status_code=409, detail="You already requested this subject")

        teacher = None
        org = None
        if subject.get("teacher_id"):
            teacher = await db.get_teacher_by_id(subject["teacher_id"])
        if subject.get("org_id"):
            org = await db.get_org_by_id(subject["org_id"])

        return {
            "enrollment_id": enrollment.get("id"),
            "subject": {
                "id": subject.get("id"),
                "name": subject.get("name"),
                "subject_code": subject.get("subject_code"),
            },
            "teacher": {
                "id": teacher.get("id") if teacher else subject.get("teacher_id"),
                "full_name": teacher.get("full_name") if teacher else "Unknown",
                "email": teacher.get("email") if teacher else "",
            },
            "organization": {
                "id": org.get("id") if org else subject.get("org_id"),
                "name": org.get("name") if org else "Organization",
            },
            "status": "pending",
            "action": action,
            "message": "Request sent! Waiting for approval.",
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/announcements")
async def create_announcement(req: CreateAnnouncementRequest):
    try:
        title = req.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")

        body = (req.body or "").strip()
        tag = (req.tag or "General").strip()
        allowed_tags = {"General", "Assignment", "Important"}
        if tag not in allowed_tags:
            raise HTTPException(status_code=400, detail="Tag must be one of: General, Assignment, Important")

        teacher, _ = await ensure_teacher_can_manage_subject(req.teacher_id, req.subject_id)

        announcement = await db.create_announcement(
            subject_id=req.subject_id,
            teacher_id=req.teacher_id,
            title=title,
            body=body,
            tag=tag,
        )

        return {
            "announcement": {
                **announcement,
                "teacher_name": teacher.get("full_name") or "Unknown",
            },
            "status": "success",
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assignments")
async def create_assignment(req: CreateAssignmentRequest):
    try:
        title = req.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")

        description = (req.description or "").strip()
        max_score = int(req.max_score if req.max_score is not None else 100)
        if max_score < 0:
            raise HTTPException(status_code=400, detail="Max score must be non-negative")

        await ensure_teacher_can_manage_subject(req.teacher_id, req.subject_id)

        assignment = await db.create_assignment(
            subject_id=req.subject_id,
            teacher_id=req.teacher_id,
            title=title,
            description=description,
            due_date=req.due_date,
            max_score=max_score,
        )

        return {
            "assignment": assignment,
            "status": "success",
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
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
        rows = await db.get_org_pending_subject_enrollments(org_id)
        members = [map_enrollment_row(row) for row in rows]
        return {"members": members, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subject/{subject_id}/pending")
async def get_subject_pending(subject_id: str):
    try:
        rows = await db.get_pending_subject_enrollments(subject_id)
        members = [map_enrollment_row(row) for row in rows]
        return {"members": members, "total": len(members), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/subject/enrollment/{enrollment_id}")
async def update_subject_enrollment(enrollment_id: str, req: MemberStatusRequest):
    try:
        status = (req.status or "").strip().lower()
        if status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Invalid status")

        enrollment = await db.get_subject_enrollment_by_id(enrollment_id)
        if not enrollment:
            raise HTTPException(status_code=404, detail="Enrollment not found")

        updated = await db.update_subject_enrollment_status(enrollment_id, status)
        return {
            "enrollment_id": enrollment_id,
            "status": status,
            "updated": bool(updated),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
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
        result = (
            db.supabase.table("org_members")
            .select("*, organizations(id, name, invite_code)")
            .eq("student_id", student_id)
            .execute()
        )
        orgs = result.data or []
        return {"orgs": orgs, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subject/student/{student_id}")
async def get_student_subjects(student_id: str):
    try:
        rows = await db.get_student_subject_enrollments(student_id)
        subjects = [map_enrollment_row(row) for row in rows]
        return {"subjects": subjects, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/{org_id}/subjects")
async def get_org_subjects(org_id: str):
    try:
        subjects = await db.get_subjects_by_org(org_id)
        return {"subjects": subjects, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/org/subject/{subject_id}/students")
async def get_subject_students(subject_id: str):
    try:
        res = (
            db.supabase.table("subject_enrollments")
            .select("students(id, name)")
            .eq("subject_id", subject_id)
            .eq("status", "approved")
            .execute()
        )

        students = []
        for row in (res.data or []):
            student = row.get("students")
            if isinstance(student, list):
                student = student[0] if student else None
            if not isinstance(student, dict):
                continue

            sid = student.get("id")
            name = student.get("name")
            if sid and name:
                students.append({"id": sid, "name": name})

        return {
            "students": students,
            "total": len(students),
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/announcements/{subject_id}")
async def get_announcements(subject_id: str):
    try:
        announcements = await db.get_announcements_by_subject(subject_id)
        return {
            "announcements": announcements,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments/{subject_id}")
async def get_assignments(subject_id: str):
    try:
        assignments = await db.get_assignments_by_subject(subject_id)
        return {
            "assignments": assignments,
            "status": "success",
        }
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


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, teacher_id: str):
    try:
        if not teacher_id:
            raise HTTPException(status_code=400, detail="teacher_id is required")
        ann = db.supabase.table("announcements").select("*").eq("id", announcement_id).execute()
        if not ann.data:
            raise HTTPException(status_code=404, detail="Announcement not found")
        if ann.data[0].get("teacher_id") != teacher_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this announcement")
        db.supabase.table("announcements").delete().eq("id", announcement_id).execute()
        return {"deleted": True, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
