"""Test POST /api/notes/generate"""
import requests

BASE_URL = "http://localhost:8000"
STUDENT_ID = "00000000-0000-0000-0000-000000000000"  # Replace with real UUID
DOCUMENT_ID = "00000000-0000-0000-0000-000000000000"  # Replace with real UUID from upload
FILENAME = "sample.pdf"

try:
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
        print("PASS ✅")
    else:
        print("FAIL ❌ status not success")
except Exception as e:
    print(f"FAIL ❌ {e}")
