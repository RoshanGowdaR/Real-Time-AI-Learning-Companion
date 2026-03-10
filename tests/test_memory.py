"""Test GET /api/memory/{student_id}"""
import requests

from _test_utils import BASE_URL, require_state

try:
    STUDENT_ID = require_state("student_id")
    r = requests.get(f"{BASE_URL}/api/memory/{STUDENT_ID}", timeout=30)
    r.raise_for_status()
    data = r.json()
    greeting = data.get("greeting", "")
    print(f"greeting: {greeting}")
    if data.get("status") == "success":
        print("PASS")
    else:
        print("FAIL: status not success")
except Exception as e:
    print(f"FAIL: {e}")
