"""Test GET /api/memory/{student_id}"""
import requests

BASE_URL = "http://localhost:8000"
STUDENT_ID = "00000000-0000-0000-0000-000000000000"  # Replace with real UUID from test_student

try:
    r = requests.get(f"{BASE_URL}/api/memory/{STUDENT_ID}", timeout=30)
    r.raise_for_status()
    data = r.json()
    greeting = data.get("greeting", "")
    print(f"greeting: {greeting}")
    if data.get("status") == "success":
        print("PASS ✅")
    else:
        print("FAIL ❌ status not success")
except Exception as e:
    print(f"FAIL ❌ {e}")
