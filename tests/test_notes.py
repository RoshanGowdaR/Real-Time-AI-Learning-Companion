"""Test POST /api/notes/generate"""
import requests

from _test_utils import BASE_URL, require_state

try:
    STUDENT_ID = require_state("student_id")
    DOCUMENT_ID = require_state("document_id")
    FILENAME = require_state("filename")
    r = requests.post(
        f"{BASE_URL}/api/notes/generate",
        json={
            "student_id": STUDENT_ID,
            "document_id": DOCUMENT_ID,
            "filename": FILENAME,
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
        print("FAIL: status not success")
except Exception as e:
    print(f"FAIL: {e}")
