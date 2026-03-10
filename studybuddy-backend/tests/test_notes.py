"""Test POST /api/notes/generate"""
import os
import uuid

import requests

BASE_URL = "http://localhost:8000"


def setup_test_data():
    """Register a student, upload a PDF, return (student_id, document_id)."""
    # 1. Register Student
    unique_email = f"test_notes_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(
        f"{BASE_URL}/api/student/register",
        json={"name": "Notes Tester", "email": unique_email},
    )
    r.raise_for_status()
    student_id = r.json()["student_id"]

    # 2. Upload Document (the upload API returns document_id)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sample_pdf = os.path.join(script_dir, "sample.pdf")
    with open(sample_pdf, "rb") as f:
        r2 = requests.post(
            f"{BASE_URL}/api/upload",
            files={"file": ("sample.pdf", f, "application/pdf")},
            data={"student_id": student_id},
            timeout=60,
        )
    r2.raise_for_status()
    document_id = r2.json().get("document_id", "")
    return student_id, document_id


try:
    STUDENT_ID, DOCUMENT_ID = setup_test_data()

    r = requests.post(
        f"{BASE_URL}/api/notes/generate",
        json={
            "student_id": STUDENT_ID,
            "document_id": DOCUMENT_ID,
            "filename": "sample.pdf",
        },
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    notes = data.get("notes", "")
    print(f"notes (first 200 chars): {notes[:200]}")
    if data.get("status") == "success":
        print("PASS")
    else:
        print("FAIL  status not success")
except Exception as e:
    print(f"FAIL  {e}")
