"""Test GET /api/memory/{student_id}"""
import requests

import uuid

BASE_URL = "http://localhost:8000"

def get_real_student_id():
    unique_email = f"test_memory_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{BASE_URL}/api/student/register", json={"name": "Memory Tester", "email": unique_email})
    r.raise_for_status()
    return r.json()["student_id"]

STUDENT_ID = get_real_student_id()

try:
    r = requests.get(f"{BASE_URL}/api/memory/{STUDENT_ID}", timeout=30)
    r.raise_for_status()
    data = r.json()
    greeting = data.get("greeting", "")
    print(f"greeting: {greeting}")
    if data.get("status") == "success":
        print("PASS ")
    else:
        print("FAIL  status not success")
except Exception as e:
    print(f"FAIL  {e}")
