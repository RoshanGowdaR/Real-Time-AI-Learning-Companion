"""Test POST /api/chat"""
import requests

from _test_utils import BASE_URL, require_state

try:
    STUDENT_ID = require_state("student_id")
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
        print("PASS")
    else:
        print("FAIL: status not success")
except Exception as e:
    print(f"FAIL: {e}")
