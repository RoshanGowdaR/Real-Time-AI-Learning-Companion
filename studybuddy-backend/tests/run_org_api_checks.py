import json
import random
import urllib.error
import urllib.request

from services.supabase_service import supabase

BASE = "http://127.0.0.1:8000"
API = BASE + "/api"


def call(method: str, path: str, payload=None):
    url = API + path
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} {path}: {details}") from exc


def run():
    with urllib.request.urlopen(BASE + "/", timeout=20) as resp:
        root = json.loads(resp.read().decode("utf-8"))

    # Test 1
    test_1 = call("POST", "/org/create", {"name": "IIT Bombay CS", "description": "Test"})
    org_id = test_1.get("org_id")
    invite_code = test_1.get("invite_code")

    # Test 2
    teacher_email = f"teacher{random.randint(100000, 999999)}@test.com"
    test_2 = call(
        "POST",
        "/org/register-teacher",
        {
            "org_id": org_id,
            "email": teacher_email,
            "full_name": "Prof. Sharma",
            "password": "test123",
            "subject_name": "Data Structures",
        },
    )
    teacher_id = test_2.get("teacher_id")
    subject_id = test_2.get("subject_id")

    # Test 3
    test_3 = call("POST", "/org/teacher/login", {"email": teacher_email, "password": "test123"})

    # Student for tests 4+
    students = supabase.table("students").select("id").limit(1).execute().data
    if not students:
        raise RuntimeError("No students found in students table for join test")
    student_id = students[0]["id"]

    # Test 4
    test_4 = call("POST", "/subject/join", {"subject_code": test_2.get("subject_code"), "student_id": student_id})

    # Test 5
    test_5 = call("GET", f"/subject/{subject_id}/pending")
    members = test_5.get("members") or []
    member = next((m for m in members if str(m.get("student", {}).get("id")) == str(student_id)), None)
    if not member:
        raise RuntimeError("Pending enrollment not found after join request")
    enrollment_id = member.get("enrollment_id")

    # Test 6
    test_6 = call("PATCH", f"/subject/enrollment/{enrollment_id}", {"status": "approved"})

    # Test 7
    test_7 = call("GET", f"/org/subject/{subject_id}/students")
    student_rows = test_7.get("students") or []
    has_student = any(str(row.get("id")) == str(student_id) for row in student_rows)

    # Test 8
    test_8 = call("GET", f"/subject/student/{student_id}")
    subject_rows = test_8.get("subjects") or []
    has_subject = any(str(row.get("subject", {}).get("id")) == str(subject_id) for row in subject_rows)

    # Test 9
    test_9 = call("GET", f"/org/{org_id}/pending")

    # Test 10
    test_10 = call("DELETE", f"/org/teacher/{teacher_id}?org_id={org_id}")
    after_subjects = call("GET", f"/org/{org_id}/subjects")
    remaining_subject_rows = after_subjects.get("subjects") or []
    has_deleted_subject = any(str(row.get("id")) == str(subject_id) for row in remaining_subject_rows)

    result = {
        "root_ok": root.get("status") == "ok",
        "test_1_create_org": {
            "passed": bool(org_id and invite_code),
            "org_id": org_id,
            "invite_code": invite_code,
        },
        "test_2_register_teacher": {
            "passed": bool(teacher_id and test_2.get("subject_code")),
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "subject_code": test_2.get("subject_code"),
            "email": teacher_email,
        },
        "test_3_teacher_login": {
            "passed": bool(test_3.get("teacher_id") and isinstance(test_3.get("subjects"), list)),
            "teacher_id": test_3.get("teacher_id"),
        },
        "test_4_join_subject": {
            "passed": test_4.get("status") == "pending",
            "status": test_4.get("status"),
            "student_id": student_id,
        },
        "test_5_pending_by_subject": {
            "passed": bool(enrollment_id),
            "enrollment_id": enrollment_id,
        },
        "test_6_update_enrollment": {
            "passed": bool(test_6.get("updated") and test_6.get("status") == "approved"),
            "status": test_6.get("status"),
        },
        "test_7_subject_students": {
            "passed": has_student,
            "students_count": len(student_rows),
        },
        "test_8_student_subjects": {
            "passed": has_subject,
            "subjects_count": len(subject_rows),
        },
        "test_9_org_pending": {
            "passed": isinstance(test_9.get("members"), list),
            "pending_count": len(test_9.get("members") or []),
        },
        "test_10_delete_teacher": {
            "passed": test_10.get("status") == "success" and not has_deleted_subject,
            "deleted_subjects": test_10.get("deleted_subjects"),
        },
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
