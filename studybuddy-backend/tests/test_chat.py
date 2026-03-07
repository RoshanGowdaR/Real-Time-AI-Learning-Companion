"""Test POST /api/chat"""
import requests

BASE_URL = "http://localhost:8000"
STUDENT_ID = "00000000-0000-0000-0000-000000000000"  # Replace with real UUID from test_student

try:
    r = requests.post(
        f"{BASE_URL}/api/chat",
        json={"student_id": STUDENT_ID, "question": "What is this document about?"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    answer = data.get("answer", "")
    print(f"answer: {answer}")
    if data.get("status") == "success":
        print("PASS ✅")
    else:
        print("FAIL ❌ status not success")
except Exception as e:
    print(f"FAIL ❌ {e}")
